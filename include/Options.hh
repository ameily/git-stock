
#ifndef GITSTOCKOPTIONS_HH
#define GITSTOCKOPTIONS_HH

#include <vector>
#include <string>
#include <git2/signature.h>


namespace gitstock {

class GitStockOptions {
public:
	std::string repoPath;
	std::string refName;
	std::vector<std::string> excludePatterns;
	bool useMailMapFile;
	bool verbose;
	uint64_t nowTimestamp;
    
    std::pair<std::string, std::string> resolveSignature(const std::string& email, const std::string& name) const;
	
	static GitStockOptions& get();
	
	bool shouldIgnorePath(const std::string& path) const;
    
    void loadMailMap(const std::string& path);
	
private:
	GitStockOptions();
};

}

#endif

