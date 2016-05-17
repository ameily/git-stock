
#include "LineAgeMetrics.hh"
#include "Options.hh"
#include <iostream>
#include <math.h>
#include <jsoncpp/json/json.h>

using namespace std;


namespace gitstock {

class LineAgeMetricsImpl {
public:
	mpz_class count;
	mpz_class sum;
	mpz_class sqsum;
	mpz_class firstCommitTimestamp;
	mpz_class lastCommitTimestamp;

	LineAgeMetricsImpl()
		: count(0), sum(0), sqsum(0), firstCommitTimestamp(0),
		lastCommitTimestamp(0) {
	}
};

LineAgeMetrics::LineAgeMetrics() : pImpl(new LineAgeMetricsImpl) {
}

LineAgeMetrics::~LineAgeMetrics() {
	delete pImpl;
}

const mpz_class& LineAgeMetrics::lastCommitTimestamp() const {
	return pImpl->lastCommitTimestamp;
}

const mpz_class& LineAgeMetrics::firstCommitTimestamp() const {
	return pImpl->firstCommitTimestamp;
}
/*
mpz_class LineAgeMetrics::sum(const mpz_class& offset) const {
	return offset > 0 ? (pImpl->count * offset) - pImpl->sum : pImpl->sum;
}

mpz_class LineAgeMetrics::sqsum(const mpz_class& offset) const {
	return offset > 0 ?
		(pImpl->sqsum - (2 * offset * pImpl->sum)) + (pImpl->count * offset * offset)
		: pImpl->sqsum;
}
*/
const mpz_class& LineAgeMetrics::lineCount() const {
	return pImpl->count;
}

mpz_class LineAgeMetrics::lineAgeVariance(const mpz_class& offset) const {
	mpz_class sum, sqsum;

	if(offset) {
		//
		// sum     = a + b + c
		// sqsum   = a2 + b2 + c2
		// sqsum_2 = (x - a)2 + (x - b)2 + (x - c)2
		//         = a2 + b2 + c2 - 2x(a + b + c) + 3x2
		//         = sqsum - 2x(sum) + 3x^2
		//
		sum = (pImpl->count * offset) - pImpl->sum;
		sqsum = pImpl->sqsum - (2 * offset * pImpl->sum) + (pImpl->count * offset * offset);
	} else {
		sum = pImpl->sum;
		sqsum = pImpl->sqsum;
	}

	return pImpl->count > 1 ?
		(sqsum - (sum * sum) / pImpl->count) / (pImpl->count - 1)
		: mpz_class(0);
}

mpz_class LineAgeMetrics::lineAgeMean(const mpz_class& offset) const {
	mpz_class sum;

	if(offset) {
		//
		// sum   = a + b + c
		// sum_2 = offset - a + offset - b + offset - c
		//       = -a - b - c + 3(offset)
		//       = 3(offset) - sum
		//
		sum = (pImpl->count * offset) - pImpl->sum;
	} else {
		sum = pImpl->sum;
	}

	return pImpl->count > 0 ? sum / pImpl->count : mpz_class(0);
}

mpz_class LineAgeMetrics::lineAgeStandardDeviation(const mpz_class& offset) const {
	//return sqrt(variance(offset));
	mpz_class var = lineAgeVariance(offset);
	return var > 0 ? sqrt(var) : mpz_class(0);
}
/*
mpz_class LineAgeMetrics::localSum() const {
	return sum(pImpl->lastCommitTimestamp);
}

mpz_class LineAgeMetrics::localSqsum() const {
	return sqsum(pImpl->lastCommitTimestamp);
}

mpz_class LineAgeMetrics::localMean() const {
	return mean(pImpl->lastCommitTimestamp);
}

mpz_class LineAgeMetrics::localVariance() const {
	return variance(pImpl->lastCommitTimestamp);
}

mpz_class LineAgeMetrics::localStandardDeviation() const {
	return standardDeviation(pImpl->lastCommitTimestamp);
}

mpz_class LineAgeMetrics::globalMean() const {
	return mean(GitStockOptions::get().nowTimestamp);
}

mpz_class LineAgeMetrics::globalVariance() const {
	return variance(GitStockOptions::get().nowTimestamp);
}

mpz_class LineAgeMetrics::globalStandardDeviation() const {
	return standardDeviation(GitStockOptions::get().nowTimestamp);
}
*/
void LineAgeMetrics::addLineBlock(uint64_t timestamp, int count) {
	mpz_class diff = timestamp * count;
	pImpl->count += count;
	pImpl->sum += diff;

	for(int i = 0; i < count; ++i) {
		pImpl->sqsum += timestamp * timestamp;
	}
	//pImpl->sqsum += diff * diff;

	if(!pImpl->firstCommitTimestamp || pImpl->firstCommitTimestamp > timestamp) {
		pImpl->firstCommitTimestamp = timestamp;
	}

	if(timestamp > pImpl->lastCommitTimestamp) {
		pImpl->lastCommitTimestamp = timestamp;
	}
}

void LineAgeMetrics::updateLineAgeMetrics(const LineAgeMetrics& other) {
	pImpl->count += other.pImpl->count;
	pImpl->sum += other.pImpl->sum;
	pImpl->sqsum += other.pImpl->sqsum;

	if(!pImpl->firstCommitTimestamp || pImpl->firstCommitTimestamp > other.pImpl->firstCommitTimestamp) {
		pImpl->firstCommitTimestamp = other.pImpl->firstCommitTimestamp;
	}

	if(other.pImpl->lastCommitTimestamp > pImpl->lastCommitTimestamp) {
		pImpl->lastCommitTimestamp = other.pImpl->lastCommitTimestamp;
	}
}

void LineAgeMetrics::toJson(Json::Value& json, const mpz_class& offset) const {
    json = Json::objectValue;
    json["lineCount"] = (Json::UInt64)pImpl->count.get_ui();
    json["firstCommitTimestamp"] = (Json::UInt64)pImpl->firstCommitTimestamp.get_ui();
    json["lastCommitTimestamp"] = (Json::UInt64)pImpl->lastCommitTimestamp.get_ui();
    json["lineAgeVariance"] = (Json::UInt64)lineAgeVariance(offset).get_ui();
    json["lineAgeStandardDeviation"] = (Json::UInt64)lineAgeStandardDeviation(offset).get_ui();
    json["lineAgeMean"] = (Json::UInt64)(offset).get_ui();
}


}
