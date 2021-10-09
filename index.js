const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const assert = require("assert");

const ref = "refs/heads/master";
const targetPath = ".";

/**
 * display the git objects tree pointing to ref
 */
function main() {
    const refPath = path.join(targetPath, "/.git", ref);
    assert(fs.existsSync(refPath), `ref: ${refPath} not exist`);
    const commitSha1 = fs.readFileSync(refPath, 'ascii')
    // trim last \n
    traverse(commitSha1.slice(commitSha1, commitSha1.length - 1));
}

function padRight(str) {
    // 'commit' is the longest tag name
    const alignLen = 'commit'.length
    return str + ' '.repeat(alignLen - str.length)
}

function traverse(sha1, indent = 0, name = '') {
    const { tag, bin, size } = readObj(sha1)
    console.log(`${'\t'.repeat(indent)}${padRight(tag)} ${sha1} ${size} ${name}`)
    if (tag === 'commit' && indent === 0) {
        let i = 0;
        for (; ; i++) {
            if (bin[i] === 0x20) {
                const firstLineTag = bin.slice(0, i).toString('ascii')
                assert(firstLineTag === 'tree', `unexpected firstLineTag:${firstLineTag}`)
                break
            }
        }
        const treeSha1 = bin.slice(i + 1, i + 41).toString('ascii')
        traverse(treeSha1)
    } else if (tag === 'tree') {
        const treeEntries = []
        let cursor = 0
        while (cursor < bin.length) {
            let fileNameStart;
            for (; ; cursor++) {
                if (bin[cursor] === 0x20) {
                    // just ignore permission mode
                    fileNameStart = cursor
                }
                if (bin[cursor] === 0) {
                    break
                }
            }
            const fileName = bin.slice(fileNameStart + 1, cursor).toString('utf-8')
            const sha1 = bin.slice(cursor + 1, cursor + 21).toString('hex')
            treeEntries.push({
                fileName,
                sha1
            })
            cursor += 21
        }
        for (const { sha1, fileName } of treeEntries) {
            traverse(sha1, indent + 1, fileName)
        }
    } else if (tag === 'blob') {
        // already printed
    } else {
        // ignore non-first-commit & tags
    }
}

function readObj(sha1) {
    const objPath = path.join(
        targetPath,
        "/.git/objects",
        sha1.slice(0, 2),
        sha1.slice(2, sha1.length)
    ).trim();
    assert(fs.existsSync(objPath), `${objPath} not exists`)

    const objBytes = fs.readFileSync(objPath);
    const buf = zlib.inflateSync(objBytes);
    let tag, size, spacePos, nullPos;

    for (spacePos = 0; ; spacePos++) {
        if (buf[spacePos] === 0x20 /*space*/) {
            tag = buf.slice(0, spacePos).toString("ascii");
            break;
        }
    }

    for (nullPos = spacePos + 1; ; nullPos++) {
        if (buf[nullPos] === 0 /*\0*/) {
            size = buf.slice(spacePos + 1, nullPos).toString("ascii");
            break;
        }
    }

    const bin = buf.slice(nullPos + 1);
    assert(size === bin.length.toString(), "size mismatch");

    return {
        tag,
        size,
        sha1,
        bin
    }
}

main();
