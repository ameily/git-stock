
#include "TreeMetrics.hh"
#include "FileMetrics.hh"
#include "LineAgeMetrics.hh"
#include "Stock.hh"
#include "util.hh"
#include "Options.hh"
#include <string>
#include <iostream>

using namespace std;


namespace gitstock {

struct TreeWalkState {
    const git_tree *tree;
    const git_commit *newestCommit;
    TreeMetricsImpl *pImpl;
};


int treeMetricsCallback(const char *root, const git_tree_entry *entry, void *payload);


class TreeMetricsImpl {
public:
    int fileCount;
    vector<FileMetrics*> files;
    LineAgeMetrics lineMetrics;
    StockCollection stocks;
    string name;
    string path;
    

    TreeMetricsImpl(const string& path, const git_tree *tree, const git_commit *newestCommit)
        : fileCount(0), path(path) {
			
        TreeWalkState state;
        git_repository *repo = git_tree_owner(tree);
        state.tree = tree;
        state.newestCommit = newestCommit;
        state.pImpl = this;

        name = basename(path.c_str());

        git_tree_walk(tree, GIT_TREEWALK_PRE, treeMetricsCallback, &state);
    }

    void update(FileMetrics *metrics) {
        ++fileCount;
        files.push_back(metrics);
        lineMetrics.update(metrics->lineMetrics());
        
        stocks.update(metrics->stocks());
    }
};

TreeMetrics::TreeMetrics(const string& path, const git_tree *tree, const git_commit *newestCommit)
    : pImpl(new TreeMetricsImpl(path, tree, newestCommit)) {

}

TreeMetrics::~TreeMetrics() {
    delete pImpl;
}

int TreeMetrics::fileCount() const {
    return pImpl->fileCount;
}

const LineAgeMetrics& TreeMetrics::lineMetrics() const {
	return pImpl->lineMetrics;
}

vector<FileMetrics*>::const_iterator TreeMetrics::begin() const {
	return pImpl->files.begin();
}

vector<FileMetrics*>::const_iterator TreeMetrics::end() const {
	return pImpl->files.end();
}

const StockCollection& TreeMetrics::stocks() const {
    return pImpl->stocks;
}


bool isTextBlob(git_repository *repo, const git_tree_entry *entry) {
	git_blob *blob;
	int rc = git_blob_lookup(&blob, repo, git_tree_entry_id(entry));
	bool isText = false;
	
	if(!rc) {
		isText = (!git_blob_is_binary(blob) &&
				  git_tree_entry_filemode(entry) == GIT_FILEMODE_BLOB);
		git_blob_free(blob);
	}
	
	return isText;
}

int treeMetricsCallback(const char *root, const git_tree_entry *entry, void *payload) {
    if(git_tree_entry_type(entry) == GIT_OBJ_BLOB) {
        TreeWalkState *state = (TreeWalkState*)payload;
        GitStockOptions& opts = GitStockOptions::get();
        string path = root;
		
		path += git_tree_entry_name(entry);
        
        if(!opts.shouldIgnorePath(path) && isTextBlob(git_tree_owner(state->tree), entry)) {
			FileMetrics *metrics = new FileMetrics(state->tree, path, state->newestCommit);
			state->pImpl->update(metrics);
			/*
			cout << path << "\n"
				<< "  Count:   " << metrics->lineMetrics().count() << "\n"
				<< "  Sum:     " << metrics->lineMetrics().sum() << "\n"
				<< "  SqSum:   " << metrics->lineMetrics().sqsum() << "\n"
				<< "  Mean:    " << metrics->lineMetrics().mean() << "\n"
				<< "  First:   " << metrics->lineMetrics().firstCommitTimestamp() << "\n"
				<< "  Last:    " << metrics->lineMetrics().lastCommitTimestamp() << "\n"
				<< "  Sum_2:   " << metrics->lineMetrics().localSum() << "\n"
				<< "  SqSum_2: " << metrics->lineMetrics().localSqsum() << "\n"
				// (pImpl->sqsum - (2 * offset * pImpl->sum)) + (pImpl->count * offset * offset)
				<< "  count * offset * offset: " << (metrics->lineMetrics().count() * metrics->lineMetrics().lastCommitTimestamp() * metrics->lineMetrics().lastCommitTimestamp()) << "\n"
				<< "  2 * offset * sum: " << (2 * metrics->lineMetrics().lastCommitTimestamp() * metrics->lineMetrics().sum()) << "\n"
				<< "  count * offset * offset: " << (metrics->lineMetrics().count() * metrics->lineMetrics().lastCommitTimestamp() * metrics->lineMetrics().lastCommitTimestamp()) << "\n"
				<< "  Last:    " << metrics->lineMetrics().lastCommitTimestamp() << "\n"
				<< "  Count:   " << metrics->lineMetrics().count() << "\n"
				<< "  Mean_2:  " << metrics->lineMetrics().localMean() << "\n"
				<< "           " << formatDuration(metrics->lineMetrics().localMean()) << "\n"
				<< "  StdDev:  " << formatDuration(metrics->lineMetrics().localStandardDeviation()) << "\n\n";
				*/
			//cout << path << ": " << formatDuration(metrics->lineMetrics().localMean())
			//	<< " -> " << formatDuration(metrics->lineMetrics().localStandardDeviation()) << "\n";
		}
    }

    return 0;
}

const string& TreeMetrics::path() const {
    return pImpl->path;
}

const string& TreeMetrics::name() const {
    return pImpl->name;
}

}
