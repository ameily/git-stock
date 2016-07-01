
#include "Options.hh"
#include <list>
#include <unistd.h>
#include <limits.h>
#include <fstream>
#include <fnmatch.h>
#include <iostream>

using namespace std;

namespace gitstock {

namespace {
GitStockOptions *__options = nullptr;
struct MailMapEntry {
    string srcName;
    string srcEmail;
    string destName;
    string destEmail;
};

vector<MailMapEntry*> mailmap;

list<string> split(const string& str, const string& seps) {
    int start = -1;
    list<string> strs;
    for(int i = 0; i < str.length(); ++i) {
        char c = str[i];
        
        if(seps.find(c) != string::npos) {
            if(start >= 0) {
                strs.push_back(str.substr(start, i));
                start = -1;
            } else {
                start = i;
            }
        } else if(start < 0) {
            start = i;
        }
    }
    
    if(start >= 0) {
        strs.push_back(str.substr(start));
    }
    
    return strs;
}

void parseMailmap(const string& path) {
    //
    // The mailmap file contains a list of items:
    //
    // [Proper Name] <proper@email> [Commit Name] <commit@email
    //
    ifstream stream;
    stream.open(path, ios::in);
    
    while(!stream.eof()) {
        string line;
        string srcName, srcEmail, destName, destEmail;
        list<string> parts;
        
        getline(stream, line);
        parts = split(line, " \t\r\n");
        
        for(string part : parts) {
            if(part[0] == '<') {
                int end = part.length() - 1;
                if(part[end] == '>') {
                    --end;
                }
                
                if(srcName.empty() && destEmail.empty()) {
                    destEmail = part.substr(1, end);
                } else {
                    MailMapEntry *entry = new MailMapEntry();
                    
                    srcEmail = part.substr(1, end);
                    
                    entry->srcName = srcName;
                    entry->srcEmail = srcEmail;
                    entry->destName = destName;
                    entry->destEmail = destEmail;
                    
                    mailmap.push_back(entry);
                    break;
                }
            } else {
                if(destName.empty() && destEmail.empty()) {
                    destName = part;
                } else {
                    srcName = part;
                }
            }
        }
    }
}

}

GitStockOptions& GitStockOptions::get() {
	if(!__options) {
		__options = new GitStockOptions();
		__options->refName = "HEAD";
		__options->useMailMapFile = false;
		__options->verbose = false;
		__options->nowTimestamp = 0;
        __options->threads = 4;
        __options->destination = "data";
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

pair<string, string> GitStockOptions::resolveSignature(const string& email, const string& name) const {
    if(useMailMapFile) {
        for(auto entry : mailmap) {
            if(entry->srcEmail == email) {
                if(entry->destName.empty()) {
                    entry->destName = name;
                }
                
                return make_pair(entry->destEmail, entry->destName);
            }
        }
    }

    return make_pair(email, name);
}

void GitStockOptions::loadMailMap(const string& path) {
    parseMailmap(path);
}

}


