

import argparse
import json
from elasticsearch import Elasticsearch
import elasticsearch.helpers
import sys
import os


def _prefix(s):
    return str(s) if s is not None else ''


class ProgressBar(object):
    '''
    A basic text-based progress bar.

    NOTE: this class is burrowed from pypsi (https://github.com/ameily/pypsi)
    with permission from the author.
    '''

    def __init__(self, count, stream=None, width=None, activity=None):
        '''
        :param int count: the total number of items
        :param stream: the output stream, defaults to ``sys.stdout``
        :param int width: total progress bar width, including activity
        :param str activity: short description to print in front of the
            progress bar
        '''
        self.count = count
        self.stream = stream or sys.stdout
        self.i = 0
        self.current_percent = 0.0
        self.activity = activity
        self.width = width
        if width is None:
            if hasattr(self.stream, 'width'):
                self.width = min(self.stream.width, 80 + len(activity or ''))
            else:
                self.width = 80
        else:
            self.width = min(width, 80 + len(activity or ''))

        self.draw()

    def draw(self, cancel=False):
        '''
        Force a redraw of the progress bar
        '''
        col = 0
        prefix = _prefix(self.activity)
        if prefix:
            col = len(prefix)

        # [XXXXXX] YY.Y%
        # 8 char count = [] YYY.Y%
        bar_width = self.width - col - 9
        percent = self.i / self.count
        fill = '=' * int(percent * bar_width)
        bar = "{prefix}[{fill}{empty}] {percent:6.1%}".format(
            prefix=prefix,
            fill=fill,
            empty=(' ' * (bar_width - len(fill))),
            percent=percent
        )

        if self.i < self.count and not cancel:
            end = ''
        else:
            end = '\n'
        print('\r', bar, sep='', end=end, flush=True)

        self.last_draw_percent = percent

    def cancel(self):
        '''
        Cancel the progress bar.
        '''
        self.draw(cancel=True)

    def tick(self, count=0):
        '''
        Increment the total number of processed items and redraw if necessarys.
        '''
        self.i += count or 1
        diff = (self.i / self.count) - self.last_draw_percent
        if self.i == self.count or diff >= 0.001:
            self.draw()

    def done(self):
        self.i = self.count
        self.draw()


def bulk_wrapper(lines, index, progress):
    for line in lines:
        obj = json.loads(line)
        data = {
            '_op_type': 'index',
            '_index': index,
            '_type': obj.pop('_type'),
            '_source': obj
        }
        yield data
        progress.tick(len(line) + 1)
    progress.done()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('-u', '--url', help='elastic url', action='store')
    parser.add_argument('-i', '--index', help='elastic index', action='store')
    parser.add_argument('-f', '--file', help='json file to push', action='store')

    #progress = ProgressBar(stream=sys.stdout, count=size, width=80,
    #                       activity="Pushing objects to Elasticsearch")

    args = parser.parse_args()

    es = Elasticsearch(hosts=[args.url])
    size = os.path.getsize(args.file)

    progress = ProgressBar(stream=sys.stdout, count=size, width=80,
                           activity="Pushing objects to Elasticsearch")

    fp = open(args.file, 'r')
    success, errors = elasticsearch.helpers.bulk(
        es, bulk_wrapper(fp, args.index, progress),
        stats_only=True
    )
    fp.close()

    print("Inserted ", success, " objects (", errors, " errors)", sep='')
