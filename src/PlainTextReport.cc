
#include "PlainTextReport.hh"
#include "TreeMetrics.hh"
#include "FileMetrics.hh"
#include "Options.hh"
#include "util.hh"
#include "Stock.hh"

using namespace std;

namespace gitstock {

PlainTextReport::PlainTextReport() {
}

PlainTextReport::~PlainTextReport() {
}

void PlainTextReport::report(const TreeMetrics& tree) {
    ostream& os = *Options.output;
    mpz_class offset = Options.nowTimestamp ? Options.nowTimestamp : tree.lastCommitTimestamp();
    // overall
    os << tree.name() << "\n"
        << "========================================================\n"
        << "Total Lines:                  " << tree.lineCount() << "\n"
        << "Files:                        " << tree.fileCount() << "\n"
        << "Average Line Age:             "
            << formatDuration(tree.lineAgeMean(offset)) << "\n"
        << "Oldest Line Age:              "
            << formatDuration(
                offset - tree.firstCommitTimestamp()
            ) << "\n"
        << "Line Age Standard Deviation:  "
            << formatDuration(tree.lineAgeStandardDeviation(offset))
            << "\n\n";

    os << "Stocks\n"
        << "=========================================================\n"
        << "\n";

    for(Stock *stock : tree.stocks()) {
        os << *stock << "\n"
            << "-----------------------------------------------------\n"
            << "Total Lines:                  " << stock->lineCount() << "\n"
            << "                              "
                << formatPercent(stock->lineCount().get_d() / tree.lineCount().get_d())
                << "\n"
            << "Average Line Age:             "
                << formatDuration(stock->lineAgeMean(offset)) << "\n"
            << "Oldest Line Age:              " << formatDuration(
                offset - stock->firstCommitTimestamp()
            ) << "\n"
            << "Line Age Standard Deviation:  "
                << formatDuration(stock->lineAgeStandardDeviation(offset))
                << "\n\n";
    }

    os << "Files\n"
        << "=========================================================\n"
        << "\n";

    for(FileMetrics *file : tree) {
        mpz_class fileOffset = Options.nowTimestamp ? Options.nowTimestamp : file->lastCommitTimestamp();
        int stockCount = 0;

        if(!file->lineCount()) {
            continue;
        }

        os << file->path() << "\n"
            << "-----------------------------------------------------\n"
            << "Total Lines:                  " << file->lineCount() << "\n"
            << "Average Line Age:             "
                << formatDuration(file->lineAgeMean(fileOffset)) << "\n"
            << "Oldest Line Age:              "
                << formatDuration(
                    fileOffset - file->firstCommitTimestamp()
                ) << "\n"
            << "Line Age Standard Deviation:  "
                << formatDuration(file->lineAgeStandardDeviation(fileOffset))
                << "\n"
            << "Top 5 Contributors:           ";

        for(Stock *stock : file->stocks()) {
            if(stockCount) {
                os << "                              ";
            }

            os << "[" << formatPercent(
                stock->lineCount().get_d() /
                file->lineCount().get_d()
            ) << "] " << *stock << "\n";

            ++stockCount;

            if(stockCount == 5) {
                break;
            }
        }

        os << "\n";
    }
}

}
