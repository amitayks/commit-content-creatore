so this is a multipay ai agent that need to operate at couple of levels. 

the overview for this project: this ai agent need to track my commits automaticlly, read them and create threads in x.com about the work i made in the various projects. 

the concept is to create intresting threads (like how professional and influancers publish in X) about my work at my projects, new tech i descover and using, and more. 

we will create that using two existing projects, each do one part of the process, one is an agent that create review for pr that integrate to Bitbucket, and one is an automation that upload content to x.com

you can find the project in: 
https://github.com/amitayks/weatherMan
https://github.com/amitayks/bitbucket-pr-reviewer

both supposed to be public, we cannot continue without you reading them All, and all the files they containe. 

so i want you to create a porpose (from openspec) and lets start enhanche the idea until we have full and complete understanding how we want the project to be and its feature.
i wnat you to think from a perspective of a senior dev, in any point of the way, ask yourself, what would he do in this case. 

ask me any question that you cant decide yourself. 

----------------------

1. lets go with github, that is my personal work space im using daily. 

2. all type of content (inclouding what you suggested), but just like the bitbucket pr reviewer, let the user decide in a json file for each project. 
(also dose it possible that instead that the ai will publish to x automaticl, it will save that in drafts and let me know when its ready, so i could review the posts without publishing them immediately?)

3. webhood interigation (like bitbucket pr reviewer), automaticlly every pr, or even forced push to the project (im used to work like that)

4. we could add interigation to other platform later on, but for now notifiy me if the draft option is possible, if not then lets see how we could review. the threads in a nice way without publishing it first. 

5. monoripo that is combining the power of both project (BUT BUILD FROM SCRATCH)

6. we will use grok for that, the latest model, for both images and the text content.

do you have another leading questions?


-------------
1. grok DOSE have open api to use, so we will use that (if at testing we see that it failing, then we move to other providers)

2. i guess that gh action is the best decition.

3. telegram bot sound interesting, how hard would it be to implement that (consinder that i have you to build that?) also we could automate the review process to have that in the bot itself, approve and reject and so from the bot itself. 

4. each project have it own settings and tone, but publish to one account, tag by project that sound interesting.

5. yes that need to be dynamic, so the post themself would fill natural and human made and not regular static bot. 

