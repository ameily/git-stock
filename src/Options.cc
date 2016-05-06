
#include "Options.hh"
#include <unistd.h>
#include <limits.h>
#include <fnmatch.h>

using namespace std;

namespace gitstock {

namespace {
GitStockOptions *__options = nullptr;
}

GitStockOptions& GitStockOptions::get() {
	if(!__options) {
		__options = new GitStockOptions();
		__options->refName = "HEAD";
		__options->useMailMapFile = false;
		__options->verbose = false;
		__options->nowTimestamp = 0;
	}
	return *__options;
}

GitStockOptions::GitStockOptions() {
	char path[PATH_MAX];
	getcwd(path, PATH_MAX);
	
	repoPath = path;
}

bool GitStockOptions::shouldIgnorePath(const string& path) const {
	for(const string& pattern : excludePatterns) {
		if(!fnmatch(pattern.c_str(), path.c_str(), 0)) {
			return true;
		}
	}
	
	return false;
}

}


