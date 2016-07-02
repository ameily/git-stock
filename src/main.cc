
#include <iostream>
#include "TreeMetrics.hh"
#include "util.hh"
#include "LineAgeMetrics.hh"
#include "PlainTextReport.hh"
#include "CommitTimeline.hh"
#include "Options.hh"
#include "GitStockLog.hh"
#include  "GitStockProgress.hh"
#include <atomic>
#include <git2.h>
#include <fstream>
#include <jsoncpp/json/json.h>
#include <limits.h>
#include <signal.h>
#include <thread>
#include <getopt.h>
#include <sys/stat.h>

using namespace std;
using namespace gitstock;


static atomic_bool running(true);
static GitStockLog logger = GitStockLog::getLogger();
static GitStockProgress *progress = nullptr;


static void printUsage(const string& app) {
	cerr << "usage: " << app << " [options] [<refname>]\n"
		<< "\n"
		<< " -C, --directory=<path>     Run as if executed from <path>.\n"
		<< " -n, --now                  Calculate age metrics from now rather than most recent commit in file/ref.\n"
        << " -o, --output=<path>        Write JSON report to directory <path>.\n"
		<< " --exclude=<pattern>        Exclude file <pattern> from processing.\n"
		<< "                            Can be specified multiple times.\n"
        << " -t, --threads=N            Spawn N number of threads (default: 4)\n"
		<< " -v, --verbose              Verbose output.\n"
		<< " --use-mailmap              Use mailmap file.\n"
		<< "\n";
}

static option long_options[] = {
	{"help", no_argument, 0, 'h'},
	{"verbose", no_argument, 0, 'v'},
	{"exclude", required_argument, 0, 'X'},
	{"use-mailmap", no_argument, 0, 'M'},
	{"directory", required_argument, 0, 'C'},
	{"now", no_argument, 0, 'n'},
    {"threads", required_argument, 0, 't'},
    {"output", required_argument, 0, 'o'},
    {"history", no_argument, 0, 'H'},
    {"pretty", no_argument, 0, 'p'},
	{0, 0, 0, 0}
};


static bool isDirectory(const string& path) {
    struct stat s;
    if(stat(path.c_str(), &s)) {
        return false;
    }
    
    return S_ISDIR(s.st_mode);
}

static bool isFileOrNotExist(const string& path) {
    struct stat s;
    if(stat(path.c_str(), &s)) {
        return true;
    }
    
    return S_ISREG(s.st_mode);
}

int parseArgs(int argc, char **argv, bool& shouldExit) {
	GitStockOptions& opts = GitStockOptions::get();
	int option_index = 0;
	int rc = 0;
	int c;

    shouldExit = false;

    while(1) {
		c = getopt_long(argc, argv, "hvC:nt:o:pH",
                        long_options, &option_index);
        if(c == -1) {
			break;
		}

		switch(c) {
		case 'v':
			opts.verbose = true;
			break;
		case 'X':
			opts.excludePatterns.push_back(optarg);
			break;
		case 'M':
			opts.useMailMapFile = true;
			break;
		case 'C':
			opts.repoPath = optarg;
			break;
		case 'h':
			printUsage(argv[0]);
			shouldExit = true;
			rc = 0;
			break;
		case 'n':
			opts.nowTimestamp = time(nullptr);
			break;
        case 't':
            opts.threads = atoi(optarg);
            if(opts.threads <= 0) {
                cerr << argv[0] << "invalid thread count: " << optarg << "\n";
                printUsage(argv[0]);
                rc = 1;
            }
            break;
        case 'o':
            opts.destination = optarg;
            break;
        case 'H':
            opts.history = true;
            break;
        case 'p':
            opts.pretty = true;
            break;
		case '?':
			rc = 1;
			break;
		default:
			printUsage(argv[0]);
			rc = 1;
			break;
		}
	}

	if(!rc && !shouldExit && optind < argc) {
		opts.refName = argv[optind];
		cout << "ref: " << opts.refName << "\n";
	}
	
	if(opts.history) {
        if(opts.destination.empty()) {
            cerr << argv[0] << ": missing required argument -o/--output.\n";
            return 1;
        } else if(!isDirectory(opts.destination)) {
            cerr << argv[0] << ": output path must be a directory when perform history analysis\n";
            return 1;
        }
    } else if(!opts.destination.empty() && !isFileOrNotExist(opts.destination)) {
        cerr << argv[0] << ": output path must be a regular file when performing single ref analysis\n";
        return 1;
    }
    
    
	return rc;
}

git_commit* resolveRef(git_repository *repo, const string& refName) {
	git_commit *commit = nullptr;
	git_object *obj;

	if(git_revparse_single(&obj, repo, refName.c_str())) {
		cerr << "ref not found\n";
		return nullptr;
	}

	if(git_object_type(obj) != GIT_OBJ_COMMIT) {
		cerr << "ref is not a commit\n";
		git_object_free(obj);
	} else {
		commit = (git_commit*)obj;
	}

    return commit;
}

string resolveRepoPath(const string& path) {
    char buff[PATH_MAX];
    string resolved;

    realpath(path.c_str(), buff);

    resolved = buff;

    if(resolved.find("/.git", resolved.length() - 5) != string::npos) {
        resolved = path.substr(0, resolved.length() - 5);
    }

    return resolved;
}

void signalHandler(int sig) {
    running.store(false);
    if(progress) {
        progress->cancel();
    }
    //cout << "\nstopping\n";
}

/**
 * Output the TreeMetrics JSON report to a file in the destination directory.
 */
void writeOutput(GitStockOptions& opts, const CommitDay *day, const TreeMetrics *metrics) {
    ostream *out;
    if(!opts.destination) {
        
    }
    string path = destination + '/' + day->shortDay() + ".json";
    Json::Value root = metrics->toJson();
    Json::StyledStreamWriter writer("    ");
    ofstream out;
    
    out.open(path.c_str());
    writer.write(out, root);
    out.close();
}



void historyWorker(CommitTimeline *timeline, GitStockOptions& opts) {
    CommitDay *day;
    git_tree *tree;
    TreeMetrics *metrics;
    git_commit *last;
    
    while(running.load()) {
        day = timeline->pop();
        if(!day) {
            break;
        }
        
        last = day->commits().back();
        git_commit_tree(&tree, last);
        
        //logger.debug() << "processing day " << day->date() << " ("
        //    << day->commits().size() << " commits)" << endlog;
        
        metrics = new TreeMetrics(opts.repoPath, tree, last);
        
        if(progress && running.load()) {
            progress->tick();
        }
        
        writeOutput(opts.destination, day, metrics);
        
        delete metrics;
        timeline->release(day);
        git_tree_free(tree);
    }
}

int runHistory(GitStockOptions& opts, git_commit *commit) {
    CommitTimeline *timeline;
    vector<thread*> threads;
    bool threadsActive = true;
    
    progress = new GitStockProgress(80);
    
    threads.reserve(opts.threads);
    
    cout << "Building timeline... " << flush;
    timeline = new CommitTimeline(commit);
    cout << "done\n"
        << "Days with activity: " << timeline->days() << "\n"
        << "Total Commits:      " << timeline->commits() << "\n";
    
    progress->setTotal(timeline->days());
    progress->draw();
    for(int i = 0; i < opts.threads; ++i) {
        thread *t = new thread(historyWorker, timeline, std::ref(opts));
        threads.push_back(t);
    }
    
    for(thread *t : threads) {
        t->join();
    }
    
    return 0;
}

int runSingle(GitStockOptions& opts, git_commit *commit) {
    git_tree *tree;
    TreeMetrics *metrics;
    PlainTextReport report;
    
    git_commit_tree(&tree, commit);
    metrics = new TreeMetrics(opts.repoPath, tree, commit);
    
    report.report();
    
    delete metrics;
    git_tree_free(tree);
    
    return 0;
}


int main(int argc, char **argv) {
	git_repository *repo;
    int rc;
    git_commit *commit;
    GitStockOptions& opts = GitStockOptions::get();
    bool shouldExit;

    if((rc = parseArgs(argc, argv, shouldExit)) != 0 || shouldExit) {
		return rc;
	}
	
	signal(SIGINT, signalHandler);

	git_libgit2_init();

    if((rc = git_repository_open_ext(&repo, opts.repoPath.c_str(), 0, nullptr))) {
        cerr << "failed to open repo: " << rc << "\n";
        return rc;
    }

    opts.repoPath = resolveRepoPath(git_repository_path(repo));

	commit = resolveRef(repo, opts.refName);

    if(opts.useMailMapFile) {
        opts.loadMailMap(opts.repoPath + "/.mailmap");
    }

    if(opts.history) {
        rc = runHistory(opts, commit);
    } else {
        rc = runSingle(opts, commit);
    }
	
	
	return rc;
}
