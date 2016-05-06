
#ifndef GITSTOCKTEXTREPORT_HH
#define GITSTOCKTEXTREPORT_HH

#include <ostream>

namespace gitstock {

class TreeMetrics;

class PlainTextReport {
public:
    PlainTextReport();
    virtual ~PlainTextReport();
    
    void report(std::ostream& os, const TreeMetrics& tree);
    
};

}


#endif



