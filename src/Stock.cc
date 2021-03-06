
#include "Stock.hh"
#include "Options.hh"

using namespace std;

namespace gitstock {

namespace {

struct StockPtrSorter {
    bool operator() (Stock *i, Stock *j) {
      return i->lineCount() > j->lineCount();
    }
};

}

class StockImpl {
public:
    string email;
    string name;
    double ownership;

    StockImpl(const git_signature *sig)
        : email(sig->email), name(sig->name), ownership(0) {
    }

    StockImpl(const string& email, const string& name)
        : email(email), name(name) {
    }
};

Stock::Stock(const git_signature *sig)
    : LineAgeMetrics(), pImpl(new StockImpl(sig)) {
}

Stock::Stock(const string& email, const string& name)
    : LineAgeMetrics(), pImpl(new StockImpl(email, name)) {
}

Stock::~Stock() {
    delete pImpl;
}

double Stock::ownership() const {
    return pImpl->ownership;
}

void Stock::calculateOwnership(int totalLineCount) {
    pImpl->ownership = lineCount().get_d() / (double)totalLineCount;
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
    updateLineAgeMetrics(other);
}

Json::Value Stock::toJson(const mpz_class& offset) const {
    Json::Value json;

    LineAgeMetrics::toJson(json, offset);
    json["AuthorName"] = pImpl->name;
    json["AuthorEmail"] = pImpl->email;
    json["Ownership"] = pImpl->ownership;
    json["_type"] = "stock";

    return json;
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
        pair<string, string> resolved = Options.resolveSignature(email, name);

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

void StockCollection::calculateOwnership(int totalLineCount) {
    for(Stock *stock : pImpl->collection) {
        stock->calculateOwnership(totalLineCount);
    }
}


Json::Value StockCollection::toJson(const mpz_class& offset) const {
    Json::Value json(Json::arrayValue);
    for(const Stock *stock : pImpl->collection) {
        json.append(stock->toJson(offset));
    }

    return json;
}


}
