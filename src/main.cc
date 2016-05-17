
#include <iostream>
#include "TreeMetrics.hh"
#include "util.hh"
#include "LineAgeMetrics.hh"
#include "PlainTextReport.hh"
#include "CommitTimeline.hh"
#include "Options.hh"
#include <git2.h>
#include <limits.h>
#include <getopt.h>

using namespace std;
using namespace gitstock;

static void printUsage(const string& app) {
	cerr << "usage: " << app << " [options] [<refname>]\n"
		<< "\n"
		<< " -C, --directory=<path>		Run as if executed from <path>.\n"
		<< " -n, --now                  Calculate age metrics from now rather than most recent commit in file/ref.\n"
		<< " --exclude=<pattern>		Exclude file <pattern> from processing.\n"
		<< "                            Can be specified multiple times.\n"
		<< " -v, --verbose				Verbose output.\n"
		<< " --use-mailmap				Use mailmap file.\n"
		<< "\n";
}

static option long_options[] = {
	{"help", no_argument, 0, 'h'},
	{"verbose", no_argument, 0, 'v'},
	{"exclude", required_argument, 0, 'X'},
	{"use-mailmap", no_argument, 0, 'M'},
	{"directory", required_argument, 0, 'C'},
	{"now", no_argument, 0, 'n'},
	{0, 0, 0, 0}
};

int parseArgs(int argc, char **argv, bool& shouldExit) {
	GitStockOptions& opts = GitStockOptions::get();
	int option_index = 0;
	int rc = 0;
	int c;

    shouldExit = false;

    while(1) {
		c = getopt_long(argc, argv, "hvC:n",
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

void run(GitStockOptions& opts, git_commit *commit) {
    CommitTimeline *timeline;
    
    cout << "Building timeline... " << flush;
    timeline = new CommitTimeline(commit);
    cout << "done\n"
        << "Days with activity: " << timeline->days() << "\n"
        << "Total Commits:      " << timeline->commits() << "\n";
    
    for(const CommitDay *day : *timeline) {
        git_tree *tree;
        TreeMetrics *metrics;
        git_commit *last = day->commits().back();
        
        cout << "Processing Day: " << day->date() << " ("
            << day->commits().size() << ")... " << flush;
        git_commit_tree(&tree, last);
        metrics = new TreeMetrics(opts.repoPath, tree, last);
        cout << "done\n";
        
        delete metrics;
    }
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

    run(opts, commit);
	
	
	return 0;
}
