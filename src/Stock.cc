
#include "Stock.hh"
#include "LineAgeMetrics.hh"
#include "Options.hh"

using namespace std;

namespace gitstock {

namespace {

struct StockPtrSorter {
    bool operator() (Stock *i, Stock *j) {
      return i->lineMetrics().count() > j->lineMetrics().count();
    }
};

}

class StockImpl {
public:
    string email;
    string name;
    LineAgeMetrics lineMetrics;
    
    StockImpl(const git_signature *sig)
        : email(sig->email), name(sig->name) {
    }
    
    StockImpl(const string& email, const string& name)
        : email(email), name(name) {
    }
};

Stock::Stock(const git_signature *sig) : pImpl(new StockImpl(sig)) {
}

Stock::Stock(const string& email, const string& name)
    : pImpl(new StockImpl(email, name)) {
}

Stock::~Stock() {
    delete pImpl;
}

const string& Stock::email() const {
    return pImpl->email;
}

const string& Stock::name() const {
    return pImpl->name;
}

string Stock::toString() const {
    return pImpl->name + " <" + pImpl->email + ">";
}

void Stock::update(const Stock& other) {
    pImpl->lineMetrics.update(other.pImpl->lineMetrics);
}

LineAgeMetrics& Stock::lineMetrics() {
    return pImpl->lineMetrics;
}

const LineAgeMetrics& Stock::lineMetrics() const {
    return pImpl->lineMetrics;
}

ostream& operator<<(ostream& os, const Stock& stock) {
    return os << stock.name() << " <" << stock.email() << ">";
}

///////////////////////////////////////////////////////////////

class StockCollectionImpl {
public:
    vector<Stock*> collection;
    
    Stock& find(const string& email, const string& name) {
        Stock *stock = nullptr;
        pair<string, string> resolved = GitStockOptions::get().resolveSignature(email, name);

        for(auto i = collection.begin(); i != collection.end() && !stock; ++i) {
            if((*i)->email() == resolved.first) {
                stock = *i;
            }
        }
        
        if(!stock) {
            stock = new Stock(resolved.first, resolved.second);
            collection.push_back(stock);
        }
        
        return *stock;
    }
    
    ~StockCollectionImpl() {
        for(Stock *stock : collection) {
            delete stock;
        }
    }
    
    void update(const StockCollectionImpl& other) {
        for(Stock *stock : other.collection) {
            find(stock->email(), stock->name()).update(*stock);
        }
    }
    
    void sort() {
        std::sort(collection.begin(), collection.end(), StockPtrSorter());
    }
};

StockCollection::StockCollection() : pImpl(new StockCollectionImpl) {
}

StockCollection::~StockCollection() {
    delete pImpl;
}

Stock& StockCollection::find(const git_signature *sig) {
    return pImpl->find(sig->email, sig->name);
}

Stock& StockCollection::find(const Stock& stock) {
    return pImpl->find(stock.email(), stock.name());
}

int StockCollection::count() const {
    return pImpl->collection.size();
}

vector<Stock*>::const_iterator StockCollection::begin() const {
    return pImpl->collection.begin();
}

vector<Stock*>::const_iterator StockCollection::end() const {
    return pImpl->collection.end();
}

void StockCollection::update(const StockCollection& other) {
    pImpl->update(*other.pImpl);
}

void StockCollection::sort() {
    pImpl->sort();
}

}
