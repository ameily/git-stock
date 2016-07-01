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

#include "GitStockProgress.hh"
#include "GitStockLog.hh"
#include <iomanip>
#include <mutex>
#include <sstream>


using namespace std;

namespace gitstock {
    
class GitStockProgressImpl {
public:
    GitStockLog logger;
    int total;
    int width;
    int barWidth;
    int current;
    double p;
    mutex drawMutex;
    time_t startTime;
    
    GitStockProgressImpl(int width)
        : logger(GitStockLog::getLogger()), total(0), width(width), current(0), p(0) {
        barWidth = width - 10;
    }
    
    void setTotal(int total) {
        this->total = total;
        startTime = time(nullptr);
    }
    
    void tick() {
        unique_lock<mutex> lock(drawMutex);
        ++current;
        double newP  = (current / (double)total) * 100.0;
        double diff = newP - p;
        
        p = newP;
        
        if(diff >= 0.1) {
            draw();
        }
    }
    
    void draw() {
        double perTick = (barWidth / (double)total) * 100.0;
        double chunk = perTick;
        ostream& os = logger.acquire();
        time_t diff = time(nullptr) - startTime;
        
        if(current) {
            os << "\r\x1b[1A";
        }
        
        os << "[";
        for(int i = 0; i < barWidth; ++i) {
            if(chunk <= p) {
                os << "=";
            } else {
                os << " ";
            }
            
            chunk += perTick;
        }
        
        os << "] " << setw(5) << fixed << setprecision(1) << p << "%\n";
        //if(current >= total) {
        //   os << "\n";
        //}
        stringstream ss;
        string est;
            
        ss << current << " / " << total;

        if(current) {
            double rate = diff / (double)current;
            int remaining = rate * (total - current);
            int hours, minutes, seconds;
            
            hours = remaining / 3600;
            remaining = remaining % 3600;
            
            minutes = remaining / 60;
            remaining = remaining % 60;
            seconds = remaining;
            
            
            ss << " (" << fixed << setprecision(2) << rate << " seconds/day; "
                << hours << "h " << setw(2) << setfill('0') << minutes
                << "m " << setw(2) << setfill('0') << seconds << "s remaining)";
        }
        
        est = ss.str();
        os << est;
        for(int i = 0; i < (width - est.length()); ++i) {
            os << " ";
        }
        
        if(current == total) {
            os << "\n";
        }
        
        os << releaselog;
    }
};

GitStockProgress::GitStockProgress(int width) : pImpl(new GitStockProgressImpl(width)) {
}

GitStockProgress::~GitStockProgress() {
    delete pImpl;
}


void GitStockProgress::setTotal(int total) {
    pImpl->setTotal(total);
}

void GitStockProgress::tick() {
    pImpl->tick();
}

int GitStockProgress::total() const {
    return pImpl->total;
}


void GitStockProgress::cancel() {
    pImpl->logger.acquire() << "\nCancelled\n" << releaselog;
}

void GitStockProgress::draw() {
    pImpl->draw();
}



    
}
