
#ifndef GITSTOCKMETRICS_HH
#define GITSTOCKMETRICS_HH

#include <stdint.h>
#include <gmpxx.h>

namespace gitstock {

class LineAgeMetricsImpl;

class LineAgeMetrics {
public:
	LineAgeMetrics();
	virtual ~LineAgeMetrics();
	
	const mpz_class& count() const;
	const mpz_class& firstCommitTimestamp() const;
	const mpz_class& lastCommitTimestamp() const;
	mpz_class sum(const mpz_class& offset = 0) const;
	mpz_class sqsum(const mpz_class& offset = 0) const;
	
	mpz_class mean(const mpz_class& offset = 0) const;
	mpz_class variance(const mpz_class& offset = 0) const;
	mpz_class standardDeviation(const mpz_class& offset = 0) const;
	
	mpz_class localSum() const;
	mpz_class localSqsum() const;
	mpz_class localMean() const;
	mpz_class localVariance() const;
	mpz_class localStandardDeviation() const;
	
	mpz_class globalMean() const;
	mpz_class globalVariance() const;
	mpz_class globalStandardDeviation() const;
	
	void update(uint64_t timestamp, int lines);
	void update(const LineAgeMetrics& other);
	
private:
	LineAgeMetricsImpl *pImpl;
};

}

#endif
