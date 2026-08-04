#!/bin/bash
# SessionStart: heal a container that came back on a STALE clone.
#
# WHY THIS EXISTS
# This project is developed on a managed remote runner whose writable disk is
# not durable. When the container restarts (idle reclamation, a crash, resuming
# after a gap) the repository comes back from an OLD image: during one session it
# reverted to the same pre-session commit four separate times, and each time
# `git status` reported CLEAN — because a stale checkout is perfectly consistent,
# just old. Once it silently cost ~800 lines of CLAUDE.md, caught only because a
# grep for a paragraph written minutes earlier came back empty.
#
# The remote is always intact; only the local clone rolls back. So the fix is to
# compare against origin on every session start and fast-forward when it is safe.
#
# WHAT IT WILL AND WILL NOT DO
#   * fast-forward ONLY when the tree is clean AND HEAD is an ancestor of
#     origin/main — i.e. exactly the rollback case, where there is nothing local
#     to lose.
#   * NEVER touch a dirty tree. Uncommitted work is the one thing that cannot be
#     recovered from the remote, so an ambiguous state gets a loud warning and no
#     action. A blanket `git reset --hard` here would destroy real work on every
#     restart where the container did NOT roll back.
#   * NEVER touch a HEAD that carries commits origin does not have — that is
#     unpushed work, not a rollback.
#   * exit 0 no matter what, so a network blip or a broken git can never wedge
#     session startup (the same rule the platform's own identity hook follows).
set -u

cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ "$branch" = "main" ] || exit 0   # only the trunk this project ships from

# A hung fetch must not block the session; give up quickly and stay silent.
timeout 25 git fetch --quiet origin main >/dev/null 2>&1 || exit 0

local_sha=$(git rev-parse HEAD 2>/dev/null) || exit 0
remote_sha=$(git rev-parse origin/main 2>/dev/null) || exit 0
[ "$local_sha" = "$remote_sha" ] && exit 0   # in sync: the normal case, say nothing

dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

if git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
  # Strictly behind — the rollback signature.
  if [ "$dirty" -eq 0 ]; then
    if git merge --ff-only origin/main >/dev/null 2>&1; then
      echo "⚠️  This clone had rolled back to ${local_sha:0:7}. Fast-forwarded to origin/main (${remote_sha:0:7}); no local work existed to lose."
    else
      echo "⚠️  This clone is BEHIND origin/main (${local_sha:0:7} vs ${remote_sha:0:7}) and the fast-forward failed. Resync before trusting local files."
    fi
  else
    echo "⚠️  This clone is BEHIND origin/main (${local_sha:0:7} vs ${remote_sha:0:7}) AND has $dirty uncommitted file(s). NOT touching them. Save that work, then: git stash -u && git merge --ff-only origin/main"
  fi
else
  echo "ℹ️  HEAD (${local_sha:0:7}) has commits origin/main (${remote_sha:0:7}) does not — unpushed work, not a rollback. Left alone."
fi

exit 0
