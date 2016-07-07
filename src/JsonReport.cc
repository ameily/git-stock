/*
 * Copyright (c) 2016, <copyright holder> <email>
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *     * Neither the name of the <organization> nor the
 *     names of its contributors may be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY <copyright holder> <email> ''AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL <copyright holder> <email> BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * 
 */

#include "JsonReport.hh"
#include "Options.hh"
#include "CommitTimeline.hh"
#include "TreeMetrics.hh"
#include "FileMetrics.hh"
#include "Stock.hh"
#include <jsoncpp/json/writer.h>
#include <fstream>
#include <mutex>
#include <errno.h>
#include <sstream>

using namespace std;


namespace gitstock {

namespace {
const static string *WEEK_DAY_NAMES = new string[7] {
    "0 - Sunday", "1 - Monday", "2 - Tuesday", "3 - Wednesday", "4 - Thursday", "5 - Friday", "6 - Saturday"
};

const static string *HOUR_NAMES = new string[24] {
    "00 (12am)", "01 (1am)", "02 (2am)", "03 (3am)", "04 (4am)", "05 (5am)",
    "06 (6am)", "07 (7am)", "08 (8am)", "09 (9am)", "10 (10am)", "11 (11am)",
    "12 (12pm)", "13 (1pm)", "14 (2pm)", "15 (3pm)", "16 (4pm)", "17 (5pm)",
    "18 (6pm)", "19 (7pm)", "20 (8pm)", "21 (9pm)", "22 (10pm)", "23 (11pm)"
};

}

class JsonReportImpl {
public:
    GitStockOptions& opts;
    ofstream stream;
    Json::StreamWriter *writer;
    
    mutex streamLock;
    
    JsonReportImpl(GitStockOptions& opts) : opts(opts) {
        Json::StreamWriterBuilder bldr;
        bldr["indentation"] = "";
        writer = bldr.newStreamWriter();
        
        openStream(opts.destination, stream);
        //openStream(opts.destination, "stocks.json", stocks);
        //openStream(opts.destination, "files.json", files);
        //openStream(opts.destination, "stock_files.json", stockFiles);
    }
    
    int openStream(const string& filename, ofstream& stream) {
        stream.open(filename);
        
        if(!stream.good()) {
            string msg = "failed to open output file ";
            msg += filename;
            msg += ": ";
            msg += strerror(errno);
            throw runtime_error(msg);
        }
        
        return stream.good() ? 0 : errno;
    }
    
    Json::Value& normalize(const CommitDay *day, Json::Value& json) {
        json["Timestamp"] = (Json::Int64)day->timestamp();
        return json;
    }
    
    void report(const CommitDay *day, const TreeMetrics *metrics) {
        // files
        // tree.json => tree information
        // stocks.json => stock information
        // files.json => file information
        // stock_files.json => stocks within files information
        unique_lock<mutex> lock(streamLock);
        mpz_class offset = opts.nowTimestamp ? opts.nowTimestamp : metrics->lastCommitTimestamp();
        Json::Value treeJson = metrics->toJson(offset);
        Json::Value dayJson = day->toJson();
        
        writer->write(dayJson, &stream);
        stream << "\n";
        writer->write(normalize(day, treeJson), &stream);
        stream << "\n";
        
        for(const FileMetrics *file : *metrics) {
            Json::Value fileJson = file->toJson(offset);
            writer->write(normalize(day, fileJson), &stream);
            stream << "\n";
            
            for(const Stock *stock : file->stocks()) {
                Json::Value stockJson = stock->toJson(offset);
                stockJson["FilePath"] = file->path();
                stockJson["_type"] = "stock-file";
                writer->write(normalize(day, stockJson), &stream); 
                stream << "\n";
            }
        }
        
        for(const Stock* stock : metrics->stocks()) {
            Json::Value stockJson = stock->toJson(offset);
            writer->write(normalize(day, stockJson), &stream);
            stream << "\n";
        }
        
        for(git_commit *commit : day->commits()) {
            Json::Value json = commitToJson(commit);
            writer->write(json, &stream);
            stream << "\n";
        }
    }
    
    Json::Value commitToJson(git_commit *commit) const {
        Json::Value json(Json::objectValue);
        const git_signature *sig = git_commit_committer(commit);
        int64_t timestamp = git_commit_time(commit);
        tm *t = localtime(&timestamp);
        const char *msg = git_commit_message(commit);
        
        json["Message"] = msg ? msg : ""; //git_commit_body(commit);
        json["Timestamp"] = (Json::Int64)timestamp;
        json["DayOfTheWeek"] = WEEK_DAY_NAMES[t->tm_wday];
        json["HourOfTheDay"] = HOUR_NAMES[t->tm_hour];
        json["_type"] = "commit";
        
        if(sig) {
            pair<string, string> resolved = GitStockOptions::get().resolveSignature(sig->email, sig->name);
            json["AuthorEmail"] = resolved.first;
            json["AuthorName"] = resolved.second;
        }
        
        return json;
    }
};

JsonReport::JsonReport(GitStockOptions& opts) : pImpl(new JsonReportImpl(opts)) {
}

JsonReport::~JsonReport() {
    delete pImpl;
}

void JsonReport::report(const CommitDay* day, const TreeMetrics* metrics) {
    pImpl->report(day, metrics);
}

void JsonReport::close() {
    pImpl->stream.close();
}



}
