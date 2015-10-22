
var git = require('nodegit');


function testFlag(value, flag) {
  return (value & flag) == flag;
}

function getDiffFile(delta) {
  return delta.newFile().id().iszero() ? delta.oldFile() : delta.newFile();
}

function isDeltaBinaryFile(delta) {
  var b = isDeltaNormalFile(delta);
  return b && testFlag(getDiffFile(delta).flags(), git.Diff.FLAG.BINARY);
}


function isDeltaNormalFile(delta) {
  var df = getDiffFile(delta);
  return testFlag(df.mode(), git.TreeEntry.FILEMODE.BLOB);
}


function isDeltaNewFile(delta) {
  return delta.oldFile().id().iszero() == 1 &&
    delta.newFile().id().iszero() == 0 &&
    testFlag(delta.status(), git.Diff.DELTA.ADDED);
}

function isDeltaDeletedFile(delta) {
  return delta.oldFile().id().iszero() == 0 &&
    delta.newFile().id().iszero() == 1 &&
    testFlag(delta.status(), git.Diff.DELTA.DELETED);
}

function isDeltaRenamedFile(delta) {
  return delta.oldFile().id().iszero() == 0 &&
    delta.newFile().id().iszero() == 0 &&
    testFlag(delta.status(), git.Diff.DELTA.RENAMED);
}

exports.getDiffFile = getDiffFile;
exports.isDeltaNormalFile = isDeltaNormalFile;
exports.isDeltaBinaryFile = isDeltaBinaryFile;
exports.isDeltaNewFile = isDeltaNewFile;
exports.isDeltaDeletedFile = isDeltaDeletedFile;
exports.isDeltaRenamedFile = isDeltaRenamedFile;
exports.testFlag = testFlag;
