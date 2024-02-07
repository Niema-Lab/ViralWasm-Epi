#! /usr/bin/env python3
'''
Compile summary file(s)
'''

# imports
from glob import glob
from json import dump as jdump

# main program
if __name__ == "__main__":
    REFS = dict()
    for fas in glob('*/*.fas'):
        ID = fas.split('/')[-2].strip()
        if ID in REFS:
            raise ValueError("Duplicate ID: %s" % ID)
        REFS[ID] = {
            'name': open('%s/%s.name.txt' % (ID,ID)).read().strip(),
            'shortname': [l.strip() for l in open('%s/%s.shortname.txt' % (ID,ID)).read().strip().splitlines()],
        }
    f = open('REFS.json', 'w'); jdump(REFS, f); f.close()
