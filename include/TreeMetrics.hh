
#ifndef GITSTOCKTREEMETRICS_HH
#define GITSTOCKTREEMETRICS_HH

#include <git2.h>
#include <cstdint>
#include <vector>
#include <string>

namespace gitstock {

class FileMetrics;
class LineAgeMetrics;
class TreeMetricsImpl;
class StockCollection;

class TreeMetrics {
public:
    TreeMetrics(const std::string& path, const git_tree *tree, const git_commit *newestCommit = nullptr);
    virtual ~TreeMetrics();

	const LineAgeMetrics& lineMetrics() const;
    int fileCount() const;
    
    const StockCollection& stocks() const;
    const std::string& name() const;
    const std::string& path() const;
    
    std::vector<FileMetrics*>::const_iterator begin() const;
    std::vector<FileMetrics*>::const_iterator end() const;

private:
    TreeMetricsImpl *pImpl;
};

}

#endif
