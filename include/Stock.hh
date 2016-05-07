
#ifndef GITSTOCKSTOCK_HH
#define GITSTOCKSTOCK_HH

#include <stdint.h>
#include <string>
#include <vector>
#include <git2/signature.h>
#include <ostream>
#include "LineAgeMetrics.hh"


namespace gitstock {

class StockImpl;

class Stock : public LineAgeMetrics {
public:
    Stock(const git_signature *sig);
    Stock(const std::string& email, const std::string& name);
    virtual ~Stock();

    const std::string& name() const;
    const std::string& email() const;

    void update(const Stock& other);

    std::string toString() const;

private:
    StockImpl *pImpl;
};

class StockCollectionImpl;

class StockCollection {
public:
    StockCollection();
    virtual ~StockCollection();

    int count() const;
    std::vector<Stock*>::const_iterator begin() const;
    std::vector<Stock*>::const_iterator end() const;

    void sort();

    Stock& find(const git_signature *sig);
    Stock& find(const Stock& stock);

    void update(const StockCollection& other);

private:
    StockCollectionImpl *pImpl;
};

std::ostream& operator<<(std::ostream& os, const Stock& stock);

}

#endif
