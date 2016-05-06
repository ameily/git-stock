
#include "PlainTextReport.hh"
#include "TreeMetrics.hh"
#include "LineAgeMetrics.hh"
#include "Options.hh"
#include "util.hh"
#include "Stock.hh"

using namespace std;

namespace gitstock {

PlainTextReport::PlainTextReport() {
}

PlainTextReport::~PlainTextReport() {
}

void PlainTextReport::report(ostream& os, const TreeMetrics& tree) {
    GitStockOptions& opts = GitStockOptions::get();
    // overall
    os << tree.name() << "\n"
        << "========================================================\n"
        << "Total Lines:                  " << tree.lineMetrics().count() << "\n"
        << "Files:                        " << tree.fileCount() << "\n"
        << "Average Line Age:             " << formatDuration(tree.lineMetrics().localMean()) << "\n"
        << "Oldest Line Age:              "
            << formatDuration(
                tree.lineMetrics().lastCommitTimestamp() -
                tree.lineMetrics().firstCommitTimestamp()
            ) << "\n"
        << "Line Age Standard Deviation:  "
            << formatDuration(tree.lineMetrics().localStandardDeviation()) 
            << "\n\n";
    
    os << "Stocks\n"
        << "=========================================================\n"
        << "\n";
    
    for(Stock *stock : tree.stocks()) {
        os << *stock << "\n"
            << "-----------------------------------------------------\n"
            << "Total Lines:                  " << stock->lineMetrics().count() << "\n"
            << "                              "
                << formatPercent(stock->lineMetrics().count().get_d() / tree.lineMetrics().count().get_d())
                << "\n"
            << "Average Line Age:             " << formatDuration(stock->lineMetrics().localMean()) << "\n"
            << "Oldest Line Age:              " << formatDuration(
                stock->lineMetrics().lastCommitTimestamp() -
                stock->lineMetrics().firstCommitTimestamp()
            ) << "\n"
            << "Line Age Standard Deviation:  "
                << formatDuration(stock->lineMetrics().localStandardDeviation())
                << "\n\n";
    }
}

}
