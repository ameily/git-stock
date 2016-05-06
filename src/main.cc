
#include <iostream>
#include "TreeMetrics.hh"
#include "util.hh"
#include "LineAgeMetrics.hh"
#include "Options.hh"
#include <git2.h>
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
		c = getopt_long(argc, argv, "hvC:",
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



int main(int argc, char **argv) {
	git_repository *repo;
    int rc;
    git_tree *tree;
    git_commit *commit;
    TreeMetrics *metrics = nullptr;
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

	commit = resolveRef(repo, opts.refName);

    if((rc = git_commit_tree(&tree, commit))) {
        cerr << "failed to get ref tree\n";
        return rc;
    }
    
    metrics = new TreeMetrics(tree);
    cout << "=======================\n"
		<< "lines:                         " << metrics->lineMetrics().count() << "\n"
		<< "files:                         " << metrics->fileCount() << "\n"
		<< "oldest commit;                 " << formatDuration(metrics->lineMetrics().lastCommitTimestamp() - metrics->lineMetrics().firstCommitTimestamp()) << "\n"
		<< "average line age:              " << formatDuration(metrics->lineMetrics().localMean()) << "\n"
		<< "line age standard deviation:   " << formatDuration(metrics->lineMetrics().localStandardDeviation()) << "\n";
	
	delete metrics;
	return 0;
}
