
#ifndef GITSTOCKFILEMETRICS_HH
#define GITSTOCKFILEMETRICS_HH

#include <string>
#include <cstdint>
#include <git2/tree.h>
#include <git2/commit.h>
#include "LineAgeMetrics.hh"
#include <jsoncpp/json/json.h>

namespace gitstock {

class FileMetricsImpl;
class StockCollection;

class FileMetrics : public LineAgeMetrics {
public:
    FileMetrics(const git_tree *tree, const std::string& path,
                const git_commit *newestCommit = nullptr);
    virtual ~FileMetrics();

	const std::string& path() const;

    const StockCollection& stocks() const;
    Json::Value toJson(const mpz_class& offset) const;

private:
    FileMetricsImpl *pImpl;
};

}

#endif
