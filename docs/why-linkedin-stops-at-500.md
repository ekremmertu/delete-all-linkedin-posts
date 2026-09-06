# Why LinkedIn's feed stops feeding after ~500 posts

*Notes from writing a bulk-delete tool that actually finishes.*

---

I wanted to delete my LinkedIn posts. All of them. LinkedIn offers no bulk
delete, so this is one post, three clicks and a confirmation modal, repeated as
many times as you have posts.

There are scripts for this. I ran one. It deleted a few hundred posts, announced
that it was finished, and left several hundred posts sitting on my profile.

The script was not lying to me. It was being lied to.

## Symptom

The activity page — `linkedin.com/in/<you>/recent-activity/all/` — is an infinite
scroll list. Scroll down, more posts load. Standard stuff, and easy to automate:
scroll, wait for new cards, delete them, repeat until scrolling stops producing
anything.

Except that scrolling stops producing anything long before you run out of posts.
Somewhere around **400–500 items**, the feed simply stops serving. You can scroll
to the bottom as many times as you like; nothing new arrives. Every heuristic a
reasonable script uses — "no new nodes after N scrolls" — fires correctly, and
concludes there is nothing left.

On my account, the page reported **37 posts remaining**. I reloaded it. There
were **481**.

The number is not a hard limit and it is not documented. It behaves like a
per-page-session ceiling on how much that particular render will pull down. What
matters is that the ceiling resets on reload.

## The counting problem, which is a different problem

Before deleting a thousand things, you would like to know that it is a thousand.
So: count the post cards on the page.

That number is wrong, and wrong in a direction that flatters you. LinkedIn
virtualizes the list — as you scroll, old cards are removed from the DOM
entirely. However far down you go, the document holds only a few hundred cards.
`document.querySelectorAll(postSelector).length` measures the size of the
window, not the size of the list.

What survives is the accessibility label. LinkedIn stamps each card it renders
with a hidden *"Feed post number N"*, and N keeps climbing for as long as the
page stays open, regardless of what has been recycled out of the DOM.

On the same account: **452 cards in the DOM, highest label N = 965.** The labels
remembered what the DOM had forgotten.

So the counter scrolls to the bottom and watches the maximum N until it stops
growing. That is an estimate, not a guarantee — N counts what LinkedIn has
actually served this page, and thanks to the ceiling above, the true total can
be higher. It is still an order of magnitude better than counting nodes.

## The fix, and why it forces an extension

The way past the ceiling is embarrassingly simple: **reload the page and keep
going.**

The reason nobody does it is equally simple: **a reload kills the code doing the
work.** That is the fatal constraint of every "paste this into your DevTools
console" tool. The snippet lives in the page. The page goes away. So does the
snippet, along with everything it had counted.

Anything that must survive its own page refresh needs somewhere to stand that is
not the page. For a browser that means an extension: state in `chrome.storage`,
and a content script that re-injects on every load, reads the state, and resumes.

The loop ends up looking like this:

1. Read state. Is a run in progress? If yes, resume; if no, wait for Start.
2. Delete posts one at a time — open the "…" menu, click the delete row, confirm
   in the modal.
3. Every N posts (50 by default), write state and reload the tab. This is what
   refills the feed.
4. When the page comes up with nothing to do, don't conclude anything yet.
   Reload and look again. Only after **three consecutive empty rounds** call it
   finished.

Step 4 is not paranoia. An empty page is exactly what the ceiling looks like from
the inside, and it is also what a slow render looks like. The two are
indistinguishable at the moment you observe them, and only repetition tells them
apart.

## The multilingual trap

One more thing, unrelated to the ceiling but fatal in its own right.

Most of these scripts find the delete option by looking for the text `"Delete"`.

On a Turkish LinkedIn, that menu row says *"Gönderiyi sil"*. On a German one,
*"Beitrag löschen"*. A tool keyed to the English string doesn't crash and doesn't
warn — it opens each menu, finds nothing it recognizes, closes it, and reports
that it deleted zero posts. It looks like the tool is broken. It is: it was
written monolingually.

The menu row carries `li.option-delete`, which is identical in every locale. Key
off the class, fall back to text only if the class ever disappears — not the
other way around.

## Takeaways

- **Infinite scroll that stops is not the same as a list that ended.** If you
  automate a feed, distinguish "no more data" from "no more data *for this page
  session*". The reload is the test.
- **Virtualized lists lie about their length.** Look for a monotonic counter the
  renderer maintains — often an accessibility label — rather than counting nodes.
- **A console snippet cannot survive a reload.** The moment your task needs to
  outlive the page, the DevTools console is the wrong home for it.
- **Never match UI text as the primary selector.** It is a silent
  internationalization bug that presents as "the tool doesn't work."
- **Go slow.** Mine waits 8–11 seconds per post. Faster is rude, and rate limits
  are worse than waiting.

The extension is MIT licensed and does the above:
**https://github.com/ekremmertu/delete-all-linkedin-posts**

No servers, no analytics, no network requests of its own. It automates clicks in
your own browser, on your own account, through the normal UI. Note that
LinkedIn's User Agreement does not permit automated tools, so this is at your own
risk on your own account — and deletion is permanent, so export your data first.
