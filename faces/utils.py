import sys

def get_error_message():
    arInfo = sys.exc_info()
    if len(arInfo) == 3:
        sMsg = "[" + str(arInfo[1]) + "]"
        if arInfo[2] != None:
            sMsg += " at line " + str(arInfo[2].tb_lineno)
        return sMsg
    else:
        return ""

def DoError(sIntro = ""):
    sMsg = sIntro +  get_error_message()
    print("Error: " + sMsg + "\n", file=sys.stderr)

