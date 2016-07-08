
#include "util.hh"
#include <git2/commit.h>
#include <sstream>
#include <iomanip>


using namespace std;

namespace gitstock {

namespace {

static const mpz_class YEAR_SECONDS(31536000);
static const mpz_class DAY_SECONDS(86400);
static const mpz_class HOUR_SECONDS(3600);
static const int64_t SECONDS_PER_DAY = 86400; // seconds in a day

}

string formatDuration(mpz_class duration) {
    stringstream ss;

    if(duration == 0) {
		return "0";
	}

    if(duration >= YEAR_SECONDS) {
        mpz_class years = duration / YEAR_SECONDS;
        duration = duration % YEAR_SECONDS;

        ss << years << "y ";
    }

    if(duration >= DAY_SECONDS) {
        mpz_class days = duration / DAY_SECONDS;
        duration = duration % DAY_SECONDS;
        ss << days << "d ";
    }

    if(duration >= HOUR_SECONDS) {
        mpz_class hours = duration / HOUR_SECONDS;
        duration = duration % HOUR_SECONDS;
        ss << hours << "h ";
    }

    if(duration >= 60) {
        mpz_class minutes = duration / 60;
        duration = duration % 60;
        ss << minutes << "m ";
    }

    if(duration) {
        ss << duration << "s";
    }

    return ss.str();
}

string formatPercent(double value) {
    stringstream ss;
    ss << fixed << setprecision(2) << (value * 100.0) << "%";
    return ss.str();
}

int64_t getDayTimestamp(const git_commit *commit) {
	int64_t timestamp = git_commit_time(commit);
	return timestamp - (timestamp % SECONDS_PER_DAY);
}


}
