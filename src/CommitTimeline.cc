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

#include "CommitTimeline.hh"
#include "GitStockLog.hh"
#include <set>
#include <unordered_map>
#include <algorithm>
#include <iostream>
#include <list>
#include <mutex>


using namespace std;

namespace gitstock {

static GitStockLog logger = GitStockLog::getLogger();    
static const int64_t SECONDS_PER_DAY = 86400; // seconds in a day

struct TimelineBuilder {
    set<string> knownCommits;
    set<int64_t> days;
    unordered_map<int64_t, vector<git_commit*>> commitDays;
};

class CommitTimelineImpl {
public:
    //set<string> known;
    //unordered_map<int64_t, vector<git_commit*>> builder;
    vector<CommitDay*> timeline;
    list<CommitDay*> activeDays;
    int commits;
    mutex timelineMutex;
    int popIndex;
    int releaseIndex;
    
    CommitTimelineImpl(git_commit *head) : commits(0), popIndex(0), releaseIndex(0) {
        TimelineBuilder builder;
        addCommit(head, builder);
        build(builder);
    }
    
    ~CommitTimelineImpl() {
        
    }
    
    void addCommit(git_commit *commit, TimelineBuilder& builder) {
        string id((const char*)git_commit_id(commit)->id, 20);
        auto result = builder.knownCommits.insert(id);
        if(result.second) {
            int64_t timestamp = git_commit_time(commit);
            int64_t day = timestamp - (timestamp % SECONDS_PER_DAY);
            unsigned int parents = git_commit_parentcount(commit);
            
            ++commits;
            
            builder.commitDays[day].push_back(commit);
            builder.days.insert(day);

            for(unsigned int index = 0; index < parents; ++index) {
                git_commit *parent;
                git_commit_parent(&parent, commit, index);
                
                addCommit(parent, builder);
            }
        }
    }
    
    void build(TimelineBuilder& builder) {
        for(int64_t timestamp : builder.days) {
            vector<git_commit*>& commits = builder.commitDays[timestamp];
            CommitDay *day = new CommitDay(timestamp, commits);
            
            timeline.push_back(day);
            
            commits.clear();
        }
        reverse(timeline.begin(), timeline.end());
    }
    
    CommitDay* pop() {
        unique_lock<mutex> lock(timelineMutex);
        CommitDay *day;
        if(popIndex < timeline.size()) {
            day = timeline[popIndex];
            ++popIndex;
            
            //cout << "Processing day: " << day->date() << " (" << day->commits().size() << ")\n";
        } else {
            day = nullptr;
        }
        
        return day;
    }
    
    void release(CommitDay *day) {
        unique_lock<mutex> lock(timelineMutex);
        day->release();
        for(; releaseIndex < timeline.size(); ++releaseIndex) {
            CommitDay *cd = timeline[releaseIndex];
            if(cd->isPendingRelease()) {
                //logger.debug() << "releasing commit day " << cd->date() << endlog;
                timeline[releaseIndex] = nullptr;
                delete cd;
            } else {
                break;
            }
        }
    }
};    

    
CommitTimeline::CommitTimeline(git_commit *head)
    : pImpl(new CommitTimelineImpl(head)) {
}

CommitTimeline::~CommitTimeline() {
    delete pImpl;
}

int CommitTimeline::commits() const {
    return pImpl->commits;
}

int CommitTimeline::days() const {
    return pImpl->timeline.size();
}

std::vector< CommitDay* >::const_iterator CommitTimeline::begin() const {
    return pImpl->timeline.begin();
}

std::vector< CommitDay* >::const_iterator CommitTimeline::end() const {
    return pImpl->timeline.end();
}

CommitDay* CommitTimeline::pop() {
    return pImpl->pop();
}

void CommitTimeline::release(CommitDay* day) {
    pImpl->release(day);
}



bool compareCommits(const git_commit *left, const git_commit *right) {
    return git_commit_time(left) < git_commit_time(right);
}

class CommitDayImpl {
public:
    int64_t timestamp;
    vector<git_commit*> commits;
    bool isPendingRelease;
    
    CommitDayImpl(int64_t timestamp, const vector<git_commit*>& commits)
        : timestamp(timestamp), commits(commits), isPendingRelease(false) {
        sort(this->commits.begin(), this->commits.end(), compareCommits);
    }
    
    ~CommitDayImpl() {
        for(git_commit *commit : commits) {
            git_commit_free(commit);
        }
    }
};

CommitDay::CommitDay(int64_t timestamp, const std::vector< git_commit* >& commits)
    : pImpl(new CommitDayImpl(timestamp, commits)) {
}

CommitDay::~CommitDay() {
    delete pImpl;
}

const std::vector< git_commit* >& CommitDay::commits() const {
    return pImpl->commits;
}

int64_t CommitDay::timestamp() const {
    return pImpl->timestamp;
}

std::vector< git_commit* >::const_iterator CommitDay::begin() const {
    return pImpl->commits.begin();
}

std::vector< git_commit* >::const_iterator CommitDay::end() const {
    return pImpl->commits.end();
}

string CommitDay::date() const {
    char buff[64];
    strftime(buff, 64, "%A %B %d, %Y", localtime(&pImpl->timestamp));
    return buff;
}

string CommitDay::shortDay() const {
    char buff[64];
    strftime(buff, 64, "%F", localtime(&pImpl->timestamp));
    return buff;
}


bool CommitDay::isPendingRelease() const {
    return pImpl->isPendingRelease;
}

void CommitDay::release() {
    pImpl->isPendingRelease = true;
}



}
