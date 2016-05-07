
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

	const mpz_class& lineCount() const;
	const mpz_class& firstCommitTimestamp() const;
	const mpz_class& lastCommitTimestamp() const;
	//mpz_class sum(const mpz_class& offset = 0) const;
	//mpz_class sqsum(const mpz_class& offset = 0) const;

	mpz_class lineAgeMean(const mpz_class& offset = 0) const;
	mpz_class lineAgeVariance(const mpz_class& offset = 0) const;
	mpz_class lineAgeStandardDeviation(const mpz_class& offset = 0) const;

	//mpz_class localSum() const;
	//mpz_class localSqsum() const;
	//mpz_class localMean() const;
	//mpz_class localVariance() const;
	//mpz_class localStandardDeviation() const;

	void addLineBlock(uint64_t timestamp, int lines);
	void updateLineAgeMetrics(const LineAgeMetrics& other);

private:
	LineAgeMetricsImpl *pImpl;
};

}

#endif
