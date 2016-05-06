
#ifndef GITSTOCKUTIL_HH
#define GITSTOCKUTIL_HH

#include <string>
#include <stdint.h>
#include <cmath>
#include <gmpxx.h>

namespace gitstock {

std::string formatDuration(mpz_class duration);
std::string formatPercent(double value);

template<typename T>
class RunningMetrics {
private:
	int n;
	T sum, sqsum;

public:
	RunningMetrics() : n(0), sum(0), sqsum(0) {
	}
	
	T mean() const {
		return n > 1 ? sum / n : sum;
	}
	
	T variance() const {
		return n > 1 ? (sqsum - (sum * sum) / n) / (n - 1) : 0;
	}
	
	T standardDeviation() const {
		return n > 1 ? std::sqrt(variance()) : 0;
	}
	
	void push(T val, int count) {
		for(int i = 0; i < count; ++i) {
			push(val);
		}
	}
	
	void push(T val) {
		++n;
		
		sum += val;
		sqsum += val * val;
	}
};


}

#endif
