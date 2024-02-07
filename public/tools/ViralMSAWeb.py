#! /usr/bin/env python3
import ViralMSA

VERSION = ViralMSA.VERSION

# override to ensure that ViralMSA sanity check for minimap2 passes for web implementation
def check_output_override(args):
    return str.encode("'Usage: minimap2'")

if ('arguments' in globals()):
    # set command line arguments, from javascript
    ViralMSA.sys.argv = arguments.split()
    # set overrides
    ViralMSA.subprocess.check_output = check_output_override
    # run ViralMSA
    ViralMSA.main()