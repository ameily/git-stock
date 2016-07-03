
#ifndef GITSTOCKTREEMETRICS_HH
#define GITSTOCKTREEMETRICS_HH

#include <git2/tree.h>
#include <git2/commit.h>
#include <cstdint>
#include <vector>
#include <string>
#include "LineAgeMetrics.hh"
#include <jsoncpp/json/json.h>

namespace gitstock {

class FileMetrics;
class TreeMetricsImpl;
class StockCollection;

class TreeMetrics : public LineAgeMetrics {
public:
    TreeMetrics(const std::string& path, const git_tree *tree, const git_commit *newestCommit = nullptr);
    virtual ~TreeMetrics();
    int fileCount() const;

    const StockCollection& stocks() const;
    const std::string& name() const;
    const std::string& path() const;

    std::vector<FileMetrics*>::const_iterator begin() const;
    std::vector<FileMetrics*>::const_iterator end() const;
    
    Json::Value toJson(const mpz_class& offset = 0) const;

private:
    TreeMetricsImpl *pImpl;
};

}

#endif
