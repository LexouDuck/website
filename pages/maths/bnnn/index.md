
# Base-Neutral Number Notation

### The "why"

I think we are lacking a number notation system which can indicate a number base in a non-ambiguous fashion.
Similar to how musicians have a clef at the beginning of a sheet of music to indicate the point of reference
of the musical staff, I think mathematics can benefit from using (sparingly!) a base-neutral number notation system
as a way of indicating the chosen number base.

Too often I have seen write the name of our common decimal system as "base 10" - if you think about it, literally every base can be said to be "base 10" (provided 0 and 1 are the first two characters chosen to represent this number base).
This goes to show how decimal-centric our point of view is. We have 10 - I mean, **ten** fingers, after all...

Others have already made great points at how other number bases can be more effective than decimal: special mention to [this video, making a great case for base 6 as a viable number base to use in everyday life](https://www.youtube.com/watch?v=qID2B4MK7Y0).

But here, the goal is to not rely on some arbitrary integer as the fundamental basis for our notation of quantities.
What else can we use to construct a number notation system ? The best answer I have come up with is to use prime numbers, or to be more exact: [the fundamental theorem of arithmetic](https://en.wikipedia.org/wiki/Fundamental_theorem_of_arithmetic). Thanks to this truth, we can simplify the problem: instead of having to design a new glyph for each and every number, we can design new glyphs only for prime numbers, and represent all the non-prime (composite) numbers by combining the prime number glyphs that make up its prime factor decomposition.

So a simple, naive approach here might look like this:

| number | primes |
|:------:|:------:|
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 22 |
| 5 | 5 |
| 6 | 23 |
| 7 | 7 |
| 8 | 222 |
| 9 | 33 |
| 10 | 25 |
| 11 | ***?*** |
| 12 | 223 |
| 13 | ***?*** |
| 14 | 27 |
| 15 | 35 |
| 16 | 2222 |
| 17 | ***?*** |

Instead of concatenating prime factors together horizontally like on the table above, my decision was to have the entire glyph be rotated by right angle, such that prime factors would be stacked up vertically to notate a composite number. This way, the width of each of the glyphs stays similar, though their heights will vary. And, since almost every human writing system writes horizontally and not vertically, it is easier to tell apart a character from its adjacent neighbors in this way.

[___Here___](sheet_Glyphs.html) is a spreadsheet of the glyphs I've decided to use. It is quite intentional that the numbers 0, 1, 2, 3, 5, and 8 look quite similar to those we know and use daily. After that, the prime number glyphs follow certain patterns in how their gyphs are designed:

- Prime glyphs which represent [twin primes](#) must be vertically symmetrical to each other.
- Prime glyphs grow more complex respective to the order they appear in - the higher the prime number the more elaborate the glyph which represents it.

There are some notable exceptional glyphs - these are mostly for speed and ease-of-writing, as well as to give this number notation system some visual flair, similar to what a natural language might enjoy.

- Square numbers (numbers with a natural integer square root, i.e. `n ∈ ℕ, √n ∈ ℕ`) have a special glyph, typically featuring n-partite symmetry.
- Cubic numbers (numbers with a natural integer cube root, i.e. `n ∈ ℕ, ∛n ∈ ℕ`)
- The number `4` is the first square number (`2×2`), as well as the first composite number, and it extremely common across the board - so it has a special glyph, borne of a conjoined concatenation of two `2`s - and so, its glyph resembles a flipped "§" section/paragraph symbol.
- The number `8` is the first cubic number (`2×2×2`), and so it also enjoys an expcetional glyph. This special glyph is really just to simply look like the `8` we are all used to.

And [___here___](sheet_Tables.html) is an (as of yet incomplete) multiplication table. seeing this table makes it easy to understand the big advantage of this number system: it makes multiplication so simple as to be nearly trivial - and it also makes us recall the big disadvantage, which is that addition is notably less simple in this system than it would be with common integer bases. This makes intuitive sense, since we based our notation system on the very idea of multication, since prime numbers and the fundamental theorem of arithmetic are just the logical consequence of the notion of multiplication.

So, I do not believe it would be very wise to begin using this notation system everywhere - but there are a select few areas where it can have its uses and merits. In particular, one thought that immediately comes to mind would be to use this to indicate the choice of a number base in a mathematics document.
