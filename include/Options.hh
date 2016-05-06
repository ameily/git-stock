
#ifndef GITSTOCKOPTIONS_HH
#define GITSTOCKOPTIONS_HH

#include <vector>
#include <string>


namespace gitstock {
	

class GitStockOptions {
public:
	std::string repoPath;
	std::string refName;
	std::vector<std::string> excludePatterns;
	bool useMailMapFile;
	bool verbose;
	uint64_t nowTimestamp;
	
	static GitStockOptions& get();
	
	bool shouldIgnorePath(const std::string& path) const;
	
private:
	GitStockOptions();
};

}

#endif

