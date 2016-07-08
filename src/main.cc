
#include <iostream>
#include "TreeMetrics.hh"
#include "util.hh"
#include "LineAgeMetrics.hh"
#include "PlainTextReport.hh"
#include "CommitTimeline.hh"
#include "Options.hh"
#include "GitStockLog.hh"
#include "GitStockProgress.hh"
#include "JsonReport.hh"
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
		<< " -n, --now                  Calculate age metrics from now rather \n"
	    << "                            than most recent commit in file/ref.\n"
		<< " -j, --json                 Force JSON output.\n"
        << " -o, --output=<path>        Write report to directory <path>.\n"
		<< " --exclude=<pattern>        Exclude file <pattern> from processing.\n"
		<< "                            Can be specified multiple times.\n"
        << " -t, --threads=<N>          Spawn N number of threads (default: 4)\n"
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
	{"json", no_argument, 0, 'j'},
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
	int option_index = 0;
	int rc = 0;
	int c;

    shouldExit = false;

    while(1) {
		c = getopt_long(argc, argv, "hvC:nt:o:pHj",
                        long_options, &option_index);
        if(c == -1) {
			break;
		}

		switch(c) {
		case 'v':
			++Options.verbose;
			break;
		case 'X':
			Options.excludePatterns.push_back(optarg);
			break;
		case 'M':
			Options.useMailMapFile = true;
			break;
		case 'C':
			Options.repoPath = optarg;
			break;
		case 'h':
			printUsage(argv[0]);
			shouldExit = true;
			rc = 0;
			break;
		case 'n':
			Options.nowTimestamp = time(nullptr);
			break;
        case 't':
            Options.threads = atoi(optarg);
            if(Options.threads <= 0) {
                cerr << argv[0] << "invalid thread count: " << optarg << "\n";
                printUsage(argv[0]);
                rc = 1;
            }
            break;
        case 'o':
            Options.destination = optarg;
            break;
        case 'H':
            Options.history = true;
            break;
        case 'p':
            Options.pretty = true;
            break;
		case 'j':
			Options.json = true;
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
		Options.refName = argv[optind];
		//cout << "ref: " << Options.refName << "\n";
	}

	if(!Options.destination.empty() && !isFileOrNotExist(Options.destination)) {
		cerr << argv[0] << ": output path must be a regular file\n";
		return 1;
	}

	if(!Options.destination.empty()) {
		ofstream *output = new ofstream();

		Options.output = nullptr;
		output->open(Options.destination.c_str());

		if(!output->good()) {
			int err = errno;
			cerr << argv[0] << ": failed to open output file "
				<< Options.destination << ": " << strerror(err) << '\n';
			return -1;
		}

		Options.output = output;
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




void historyWorker(CommitTimeline *timeline, JsonReport& report) {
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

        metrics = new TreeMetrics(Options.repoPath, tree, last);

        if(progress && running.load()) {
            progress->tick();
        }

        //writeOutput(Options.destination, day, metrics);
        report.report(day, metrics);

        delete metrics;
        timeline->release(day);
        git_tree_free(tree);
    }
}

int runHistory(git_commit *commit) {
    CommitTimeline *timeline;
    vector<thread*> threads;
    bool threadsActive = true;
    JsonReport report;

    progress = new GitStockProgress(80);

    threads.reserve(Options.threads);

    cout << "Building timeline... " << flush;
    timeline = new CommitTimeline(commit);
    cout << "done\n"
        << "Days with activity: " << timeline->days() << "\n"
        << "Total Commits:      " << timeline->commits() << "\n";

    progress->setTotal(timeline->days());
    progress->draw();
    for(int i = 0; i < Options.threads; ++i) {
        thread *t = new thread(historyWorker, timeline, std::ref(report));
        threads.push_back(t);
    }

    for(thread *t : threads) {
        t->join();
    }

    return 0;
}

int runSingle(git_commit *commit) {
    git_tree *tree;
    TreeMetrics *metrics;
    PlainTextReport report;

    git_commit_tree(&tree, commit);
    metrics = new TreeMetrics(Options.repoPath, tree, commit);

    report.report(*metrics);

	if(Options.json) {

	}

    //delete metrics;
    git_tree_free(tree);

    return 0;
}


int main(int argc, char **argv) {
	git_repository *repo;
    int rc;
    git_commit *commit;
    bool shouldExit;

	GitStockOptions::initialize();

    if((rc = parseArgs(argc, argv, shouldExit)) != 0 || shouldExit) {
		return rc;
	}

	signal(SIGINT, signalHandler);

	git_libgit2_init();

    if((rc = git_repository_open_ext(&repo, Options.repoPath.c_str(), 0, nullptr))) {
        cerr << "failed to open repo: " << rc << "\n";
        return rc;
    }

    Options.repoPath = resolveRepoPath(git_repository_path(repo));

	commit = resolveRef(repo, Options.refName);

    if(Options.useMailMapFile) {
        Options.loadMailMap(Options.repoPath + "/.mailmap");
    }

    if(Options.history) {
        rc = runHistory(commit);
    } else {
        rc = runSingle(commit);
    }

	if(!Options.destination.empty() && Options.output && Options.output != &cout) {
		((ofstream*)Options.output)->close();
	}

	return rc;
}
