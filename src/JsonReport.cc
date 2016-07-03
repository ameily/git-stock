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

using namespace std;


namespace gitstock {

class JsonReportImpl {
public:
    GitStockOptions& opts;
    
    ofstream tree;
    ofstream stocks;
    ofstream files;
    ofstream stockFiles;
    Json::StreamWriter *writer;
    
    mutex streamLock;
    
    JsonReportImpl(GitStockOptions& opts) : opts(opts) {
        Json::StreamWriterBuilder bldr;
        bldr["indentation"] = "";
        writer = bldr.newStreamWriter();
        
        tree.open((opts.destination + "/tree.json").c_str());
        stocks.open((opts.destination + "/stocks.json").c_str());
        files.open((opts.destination + "/files.json").c_str());
        stockFiles.open((opts.destination + "/stock_files.json").c_str());
    }
    
    Json::Value& normalize(const CommitDay *day, Json::Value& json) {
        json["date"] = day->shortDay();
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
        
        writer->write(normalize(day, treeJson), &tree);
        tree << "\n";
        
        for(const FileMetrics *file : *metrics) {
            Json::Value fileJson = file->toJson(offset);
            writer->write(normalize(day, fileJson), &files);
            files << "\n";
            
            for(const Stock *stock : file->stocks()) {
                Json::Value stockJson = stock->toJson(offset);
                stockJson["path"] = file->path();
                writer->write(normalize(day, stockJson), &stockFiles); 
                stockFiles << "\n";
            }
        }
        
        for(const Stock* stock : metrics->stocks()) {
            Json::Value stockJson = stock->toJson(offset);
            writer->write(normalize(day, stockJson), &stocks);
            stocks << "\n";
        }
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
    pImpl->files.close();
    pImpl->stockFiles.close();
    pImpl->stocks.close();
    pImpl->tree.close();
}



}
