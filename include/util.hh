
#ifndef GITSTOCKUTIL_HH
#define GITSTOCKUTIL_HH

#include <string>
#include <stdint.h>
#include <cmath>
#include <gmpxx.h>

struct git_commit;

namespace gitstock {

std::string formatDuration(mpz_class duration);
std::string formatPercent(double value);
int64_t getDayTimestamp(const git_commit *commit);


}

#endif
