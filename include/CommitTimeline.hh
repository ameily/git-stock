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

#ifndef COMMITTIMELINE_H
#define COMMITTIMELINE_H

#include <git2/commit.h>
#include <vector>
#include <string>
#include <stdint.h>

namespace gitstock {

class CommitTimelineImpl;
class CommitDayImpl;

class CommitDay {
public:
    CommitDay(int64_t timestamp, const std::vector<git_commit*>& commits);
    virtual ~CommitDay();
    
    std::string date() const;
    std::string shortDay() const;
    int64_t timestamp() const;
    const std::vector<git_commit*>& commits() const;
    
    std::vector<git_commit*>::const_iterator begin() const;
    std::vector<git_commit*>::const_iterator end() const;
    
    bool isPendingRelease() const;
    void release();
    
private:
    CommitDayImpl *pImpl;
};

class CommitTimeline
{
public:
    CommitTimeline(git_commit *head);
    ~CommitTimeline();
    
    int days() const;
    int commits() const;
    std::vector<CommitDay*>::const_iterator begin() const;
    std::vector<CommitDay*>::const_iterator end() const;
    
    CommitDay* pop();
    void release(CommitDay *day);

private:
    CommitTimelineImpl *pImpl;
};

}

#endif // COMMITTIMELINE_H
