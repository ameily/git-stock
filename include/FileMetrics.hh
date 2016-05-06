
#ifndef GITSTOCKFILEMETRICS_HH
#define GITSTOCKFILEMETRICS_HH

#include <string>
#include <cstdint>
#include <git2.h>

namespace gitstock {

class LineAgeMetrics;
class FileMetricsImpl;
class StockCollection;

class FileMetrics {
public:
    FileMetrics(const git_tree *tree, const std::string& path,
                const git_commit *newestCommit = nullptr);
    virtual ~FileMetrics();

	const std::string& path() const;
	
    const LineAgeMetrics& lineMetrics() const;
    
    const StockCollection& stocks() const;

private:
    FileMetricsImpl *pImpl;
};

}

#endif
