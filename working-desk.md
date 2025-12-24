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

-----------------------

ok lets go thrpugh this systematicly

starting with the telegram bot
how the bot should operate,
1. before user click the "start" button to start initiating with the bot, there is a welcome message that explain the bot purpose.
2. for each "/start" message the user send, the bot will send the general message with the "status" state. 

that message will have:
"Approve" | "generate" | "drafts"
--------------------------------
"help" | "schedule" | "delete"

Approve: send all the approved drafts (excluding scheduls draft).
generate: ask the user to send the commit sha for drast creation.
drafts: show a pagination list for the draft post, by clicking on the on item, the message transform to the draft with the dynamic action button, 
"approve" | "edit" | "reject" 
-----------------------------
"regenerate" | "schedule" 

help: show a clear instruction of how to operate the bot with all of his commands.
schedule: lets you schedule a post creaton for spesific commit sha (like generate) but skipping the /approve step for those action, so when the time is come the post will automaticly post. 
delete: lets you delete posts by commit sha, it will show a list of all the post that created for that commit, clicking on onw item will show the draft (in the same dynamic message) with "delete" | "back" for action.

all general command are also working in the "/" option for quick handeling, like /generate or /status /approve /drafts /help /schedule /delete 

CLEARAFICATION! 
all post are created only for PR! but if i send a message like "/generate 2b5819b" then it will see the whole PR and created the post on that, if i run the "/schedule 2b5819b" then it will create on the whole PR, if i search for "/delete 2b5819b" then it will show me all the post that created on that PR where the commit is being publish in. 

so with that, understant when the bot need to send new message and when it need to dynamicly change the message content. UX IS IMPORTANT!

for the claudeflare lets move to use that when we only fetch commit from GitHub API.
build the migration FROM SCRATCH, as if we first deploy to clidfalre from th efirst place. 

for every decition think "how a senior dev would have done in this case?" 

------------------------------

great so for that we will need to add more control to our telegram bot. 

lets add an "Repos" button to the general message for all the repos we are auto tracking.
by clicking on that, we will have a list of buttons, onw for each repo, 
and the top button will always be "Add new repo"

when clicking on one of the repos button, the message will update to the repo info, and the buttons will update to 
"delete" | "stop whatching" / "resome whatching" | "edit"

for every repo we could configure a config/projects/example.yaml, so we could decide the tone and the platform to send to and more. 
let add that in a nice ux for configuration and for updating over time.

with that als plan the claudeflare integration for the auto detect as u suggested. 
for every decition think "how a senior dev would have done in this case?" 

------------------------------------
great, so lets make a big change and build a plan for that. 

lets add the function to edit the drafts we created.
the user click on the Edit button ->
message indicate "what changes would you like to make?" ->
the user write ONE message that it sending to the bot -> 
the bit trasfer this message with all the already info that incloud to making that draft + the user instruction -> 
grom get that and make the changes accordingly and return to the bot -> 
the Same draft id updated with the new draft. 

now for maximum content understanding, we will add to the repo configuration those parameters: 
What Grok will get: current info / current info + actual dode that changed / current info + all the files changed contaning / (advanced) current info + folder content of files that changed.
Language: hebrew / english. for the content genertion language (the we will use different prompt for each language for maximum effort)
minCommitsForThread: 3
 maxTweets: 10
 alwaysGenerateThreadImage: true
 singleTweetImageProbability: 0.7

improving image generation:
we will store the image in R2 db and save the url to the D1 and send them with the draft via telegram bot.

im attaching the instruction of a better way to create the images and how we will do it, let take the path that Grok is gewnerating a consisct image prompt output (with the draft itself and we will extract that and immediately send to image gen). 

"What Info Should You Send to the Model?
Feed the model (Grok/Flux image gen) laser-focused deets to avoid garbage outputs like that attached pic (which is basically "code on a dark screen" vibes—zero context, all aesthetic fluff). The goal: Make images that add value, like highlighting key code changes or visualizing PR impacts, so they educate or entertain your X audience.
Key info to include:
Commit/PR Metadata: Repo name, commit message, PR title/description (if PR), author, branch (e.g., "main").
Code Changes: Summarized diff—top 3-5 key lines added/removed, file names, language (e.g., "Added TypeScript function in src/grok.ts to handle AI prompts").
Contextual Highlights: What changed functionally? (e.g., "Optimized webhook handler for faster processing" or "Fixed bug in D1 query causing draft leaks").
Visual Style Hints: Desired theme (e.g., "futuristic holographic code display", "clean code editor screenshot with highlights", "flowchart of PR changes").
Relevance Filter: Only send snippets <200 chars to avoid prompt bloat—use GitHub API to grab diffs and truncate smartly.
Don't overload; aim for concise, vivid inputs so the model spits out something tweet-worthy.
In What Format? (Plain Text? JSON?)
For the Image Gen Model Prompt: Plain text all the way—image AIs like Flux/Grok thrive on natural, descriptive paragraphs. JSON might confuse 'em unless the API explicitly supports structured inputs (check docs, but usually it's a single "prompt" string field).
Example Prompt (crafted in your code): "Create a sleek, dark-themed holographic tablet displaying highlighted TypeScript code from a GitHub commit. Show lines like 'async function generateThread(commit: Commit) { ... }' with green highlights on new additions. Include subtle repo name 'commit-content-creatore' in the corner and a tagline 'PR Update: Faster AI Integration'. Make it futuristic and engaging for developers."
Why plain text? It's flexible for creativity—lets the model riff while staying grounded.
For Building the Prompt (Optional Upstream Step): If you want Grok to generate the image prompt first (meta-AI vibes), send structured JSON to that text-gen call. This ensures consistency.
Example JSON Payload to Grok Text API:
{
  "commit_message": "Refactored webhook handler for better error handling",
  "diff_snippet": "diff --git a/src/handlers/github-webhook.ts\n+ try { await processEvent(event); } catch (e) { logError(e); }",
  "repo_name": "amitayks/commit-content-creatore",
  "pr_title": "Enhance Reliability",
  "language": "TypeScript",
  "visual_type": "code_snippet",  // or "diagram" for flowcharts
  "instructions": "Generate a detailed image prompt for a visually appealing representation of this code change, optimized for X threads. Make it informative, not generic."
}
Grok responds with a plain text prompt, which you then feed to image gen. This adds a layer of smarts—Grok can infer cool visuals from the JSON."

