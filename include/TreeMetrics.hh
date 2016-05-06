
#ifndef GITSTOCKTREEMETRICS_HH
#define GITSTOCKTREEMETRICS_HH

#include <git2.h>
#include <cstdint>
#include <vector>

namespace gitstock {

class FileMetrics;
class LineAgeMetrics;
class TreeMetricsImpl;

class TreeMetrics {
public:
    TreeMetrics(const git_tree *tree, const git_commit *newestCommit = nullptr);
    virtual ~TreeMetrics();

	const LineAgeMetrics& lineMetrics() const;
    int fileCount() const;
    
    std::vector<FileMetrics*>::const_iterator begin() const;
    std::vector<FileMetrics*>::const_iterator end() const;

private:
    TreeMetricsImpl *pImpl;
};

}

#endif
