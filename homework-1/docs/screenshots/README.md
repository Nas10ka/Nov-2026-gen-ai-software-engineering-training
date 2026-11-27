# Screenshots

There are three folders: 
- **`API transactions requests`** - the script sample-responses.sh runs all possible API requests, each request contains the goal of API request and expected result, in the end it compares to the actual response and prints status PASS or FAIL.

- **`Chat with CODEX`** - I asked codex to create a plan, approved it and asked for implementation and adding the tests. - Here all tests were running sucessfully. 
After the implementation was done I asked in a new chat to review the logic. At this step it found some logic issues. I asked to add the proper integration tests that will cover those gaps. - Here I got more tests and some of them were failing.
In the first chat I asked to review the tests and to fix the logic so it would pass the tests. 
In the third chat I ask to add script with samples of transactions, so I could automatically check all API requests and responses. 
In the end I asked to create node script to send 101 request and validate that if there were send within 60 sec. The 101th request should fail with TOO MANY REQUESTS ERROR. And added a timer to be sure that 100 concurrent requests are taking less than 60 seconds. 

- **`Install and Run`** - there is a script that will run for you all commands
```
npm install
npm run test
npm run typecheck
npm run build
npm run start
```
On the screenshots it's shown that all tests are pass and application is running. 