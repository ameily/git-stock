

import argparse
import json
from elasticsearch import Elasticsearch
import elasticsearch.helpers


def bulk_wrapper(lines, index):
    for line in lines:
        obj = json.loads(line)
        data = {
            '_op_type': 'index',
            '_index': index,
            '_type': obj.pop('_type'),
            '_source': obj
        }
        yield data


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('-u', '--url', help='elastic url', action='store')
    parser.add_argument('-i', '--index', help='elastic index', action='store')
    parser.add_argument('-f', '--file', help='json file to push', action='store')
    
    args = parser.parse_args()
    
    es = Elasticsearch(hosts=[args.url])
    fp = open(args.file, 'r')
    success, errors = elasticsearch.helpers.bulk(es, bulk_wrapper(fp, args.index), stats_only=True)#, index=args.index)
    fp.close()
    
    print("Inserted", success, "objects (", errors, "errors)")
