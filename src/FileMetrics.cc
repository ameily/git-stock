
#include "FileMetrics.hh"
#include "util.hh"
#include "Stock.hh"
#include <git2/blame.h>
#include <ctime>

using namespace std;

namespace gitstock {


class FileMetricsImpl {
public:
	string path;
    LineAgeMetrics& lineMetrics;
    StockCollection stocks;

    FileMetricsImpl(LineAgeMetrics& lineMetrics, const git_tree *tree, const string& path,
				    const git_commit *newestCommit)
		: lineMetrics(lineMetrics), path(path) {

        git_repository *repo = git_tree_owner(tree);
        git_blame *blame;
        git_commit *commit;
		uint32_t hunkCount;
        int rc;
	git_blame_options opts = GIT_BLAME_OPTIONS_INIT;

		if(newestCommit) {
			const git_oid *commitId = git_commit_id(newestCommit);
			opts.newest_commit = *commitId;
		}

        rc = git_blame_file(&blame, repo, path.c_str(), &opts);

        if(rc) {
			return;
		}

        hunkCount = git_blame_get_hunk_count(blame);

        for(uint32_t i = 0; i < hunkCount; ++i) {
            const git_blame_hunk *hunk = git_blame_get_hunk_byindex(blame, i);
            addHunk(repo, hunk);
        }

        stocks.sort();

        git_blame_free(blame);
    }

    void addHunk(git_repository *repo, const git_blame_hunk *hunk) {
        git_commit *commit;
        const git_signature *sig;
        time_t now = time(nullptr);

        git_commit_lookup(&commit, repo, &hunk->final_commit_id);
        sig = git_commit_committer(commit);

		lineMetrics.addLineBlock(git_commit_time(commit), hunk->lines_in_hunk);

        if(sig) {
            stocks.find(sig).addLineBlock(git_commit_time(commit), hunk->lines_in_hunk);
        }

        git_commit_free(commit);
    }
};

FileMetrics::FileMetrics(const git_tree *tree, const string& path,
    const git_commit *newestCommit)
    : LineAgeMetrics(), pImpl(new FileMetricsImpl(*this, tree, path, newestCommit)) {

}

FileMetrics::~FileMetrics() {
    delete pImpl;
}

const string& FileMetrics::path() const {
	return pImpl->path;
}

const StockCollection& FileMetrics::stocks() const {
    return pImpl->stocks;
}

Json::Value FileMetrics::toJson(const mpz_class& offset) const {
    Json::Value json;
    LineAgeMetrics::toJson(json, offset);
    json["_type"] = "file";
    json["FilePath"] = pImpl->path;
    //json["stocks"] = pImpl->stocks.toJson();
    
    return json;
}


}
