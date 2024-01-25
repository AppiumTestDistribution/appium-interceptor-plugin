## Appium interceptor commands

Create the appium session by passing `appium:intercept : true` option in the desired capability. Once the session is successfully created, tests can manage the api mocking using below commands. 

### Mock Configuration
Mock configuration is a json object that defines the specification for filtering and applying various updates to the api request and below is the structure for the config object.

```javascript
{
  url: string;
  method?: string;
  updateUrl?: [{ regexp: string, value: string}];
  headers?: object  | { add: object : string, remove: string[]};
  requestBody?: string;
  updateRequestBody?: [{regexp: string, value: string }] | [{jsonPath: string, value: string}];
  statusCode?: number;
  responseHeaders?: object  | { add: object : string, remove: string[]};
  responseBody?: string;
  updateResponseBody?: [{regexp: string, value: string }] | [{jsonPath: string, value: string}];
}
```

| Name   | Type   | Required | Description                                               | Example |
| ------ | ------ | -------- | --------------------------------------------------------- | ------- |
| url | string | yes      | Regular Expression or Glob pattern matcher to filter the request for applying the mock | Sample url : `https://www.reqres.in/api/users?page=1` <br> Regex example: `/api/users?.*/g` <br> Glob pattern: `**/api/users*?*`    |
| method | string | no | Method to matching the request for applying the mock | `GET` / `POST` / `PUT` / `PATCH` |
| updateUrl |string | no | Regular Expression patter and replaceable value to update the outgoing url | Sample url : `https://www.reqres.in/api/users?page=1` <br> When passing `{ updateUrl : {regexp: "/page=(\\d)+/g", value: "page=5"} }` <br> Then outgoing url will be replaced to `https://www.reqres.in/api/users?page=2` |
| headers | object | no | Map of key value pairs to be added or removed from the request header | 1. Passing a plain object map will add all the key: value pairs to the request headers `{headers : {"Content-Type" : "application/json", "Authorization": "Bearer sometoken"} }`  <br> 2. If you want to add and remove header values simulaneously then you can pass the header as `{headers : { add : {"Content-Type" : "application/json"}, remove: ["Authorization", "X-Content-Type"] } }` |
| requestBody | string | no | This will replace the original payload (post body) send to api the from the application and updates it with new body | When passing `{"url" : "/api/login/g" , "requestBody": "{\"email\": \"invalid@email.com\", \"password\": \"wrongpassword\"}"}` will send the given payload for all login api calls made from the application |
| updateRequestBody | string | no | This is similar to requestBody but instead of fully replacing the request payload, you can replace any value in the payload using Regular expression or jsonpath | Consider you application sending `{\"username\": \"someusername\", \"email\": \"someemail@email.com\", \"password\": \"somepassword\", \"isAdmin\" : \"false\"}` as a payload for a register user api request and you want to update the email and username, then you can pass <br>  `{"updateRequestBody": [{ "jsonPath": "$.email", "newemail@email.com" }, { "jsonPath": "$.username", "new_username" }]}` and it will update the email and username field before sending the request to the server|
| statusCode | number | no | Updates the response status code with the given value | To simulate any unexpected error you can send some of the below statusCode <br> 1. `500` - Internal server error <br> 2. `400` - Bad request <br> 3. `401` - Unauthorized |
| responseHeaders | object | no | Map of key value pairs to be added or removed from the response header | Same syntax as `headers` key. But this will update the response header |
| responseBody | object | no | This will replace the original response data returned by the api server and updates it with new data | Passing the config as `{"url" : "/api/login/g" , "responseBody": "{\"error\": \"User account locked\"}", `statusCode`: 400 }` will simulate a error scenario when logged in with any user credentilas |
| updateResponseBody | string | no | This is similar to responseBody but instead of fully mocking the server response, you can replace any value in the response using Regular expression or jsonpath | Consider you application returns user data as `{\"username\": \"someusername\", \"email\": \"someemail@email.com\", \"isAdmin\" : \"false\"}` as a response for get user api request and you want to update the values for email and IsAdmin fiels, then you can pass <br>  `{"updateRequestBody": [{ "jsonPath": "$.email", "newemail@email.com" }, { "jsonPath": "$.isAdmin", "true" }]}` and it will update the email and isAdmin field before sending the response back to the application|


## Commands:

### interceptor: addMock

Add a new mock specification for intercepting and updating the request. The command will returns a unique id for each mock which can be used in future to delete the mock at any point in the test.

#### Example:

```javascript
 const authorizationMock = await driver.execute("interceptor: addMock", [{
    config: {
        url "**/reqres.in/**",
        headers: {
            "Authorization" : "Bearer bearertoken"
        }
    }
 }]);

  const userListGetMock = await driver.execute("interceptor: addMock", [{
    config: {
        url "**/reqres.in/api/users",
        method: "GET",
        responseBody: JSON.stringify({
            page: 2,
            count: 2,
            data: [
                {
                    "first_name" : "User",
                    "last_name" : "1"
                 },
                 {
                     "first_name" : "User",
                     "last_name" : "2"
                }
            ]
        })
    }
 }]);
```

`authorizationMock` will be executed for all api calls made to `reqres.in` domain and `userListGetMock` will be applied for `https://www.reqres.in/api/users` with `GET` http method. 

### interceptor: removeMock
Given a mockId return during addMock command, will remove the mock configuration from the proxy sever.

#### Example:

```javascript
 const authorizationMock = await driver.execute("interceptor: addMock", [{
    config: {
        url "**/reqres.in/**",
        headers: {
            "Authorization" : "Bearer bearertoken"
        }
    }
 }]);

 //peform user action
 //perform validation
 ..
 ..

 await driver.execute("interceptor: removeMock", [{
    id: authorizationMock
 }]);

 // authorizationMock will not be active after this point and the test will proceed with normal flow
```

### interceptor: startListening

Start listening for all network traffic (API calls) made by the device during a session

#### Example:

```javascript
  await driver.execute("interceptor: startListening");
  // perform some action
  // ...
```

It also supports filtering the request based on the url. `include` will only listents for requests that macthes the given url pattern and `exclude` will listen for all api's that doesn't match the url pattern.

```javascript
  await driver.execute("interceptor: startListening", [{
    config: {
      "include" : {
        url "**/reqres.in/**",
      }
    }
 }]);
  // perform some action
  // ...
```

```javascript
  await driver.execute("interceptor: startListening", [{
    config: {
      "exclude" : {
        url "**/reqres.in/**",
      }
    }
 }]);
  // perform some action
  // ...
```

### interceptor: stopListening

Stops listening for networks traffic and return all previously recorded api calls.

#### Example:

```javascript
  await driver.execute("interceptor: startListening");
  // perform some action
  // ...
  const apiRequests = await driver.execute("interceptor: stopListening");
```

#### Returns:

stopListening command will retunrs an array of network details in the below JSON format

```javascript
[
  {
      "requestBody": "",
      "requestHeaders": {
        "host": "reqres.in",
        "connection": "keep-alive",
        "content-length": "41",
        "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
        "sec-ch-ua-mobile": "?1",
        "user-agent": "Mozilla/5.0 (Linux; Android 12; sdk_gphone64_arm64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36",
        "content-type": "application/json",
        "accept": "*/*",
        "origin": "https://reqres.in",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "referer": "https://reqres.in/",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9",
        "cookie": "_gid=GA1.2.1828776619.1706164095; __stripe_mid=3d0fd295-9d68-4d75-bdb2-55b809fb49ed8dba35; __stripe_sid=466b9d3a-2d7b-4f48-9c66-ca859c8d342f06a86f; _gat=1; _gat_gtag_UA_174008107_1=1; _ga_CESXN06JTW=GS1.1.1706164096.1.1.1706166680.0.0.0; _ga=GA1.1.546181777.1706164095; _ga_WSM10MMEKC=GS1.2.1706164097.1.1.1706166681.0.0.0"
      },
      "url": "https://reqres.in/api/users/2",
      "method": "PUT",
      "responseBody": "{\"name\":\"morpheus\",\"job\":\"zion resident\",\"updatedAt\":\"2024-01-25T07:24:58.607Z\"}",
      "responseHeaders": {
        "http/1.1 200 ok": "HTTP/1.1 200 OK",
        "date": "Thu, 25 Jan 2024 07:24:58 GMT",
        "content-type": "application/json; charset=utf-8",
        "transfer-encoding": "chunked",
        "connection": "close",
        "report-to": "{\"group\":\"heroku-nel\",\"max_age\":3600,\"endpoints\":[{\"url\":\"https://nel.heroku.com/reports?ts=1706167498&sid=c4c9725f-1ab0-44d8-820f-430df2718e11&s=OTZf6wqjMxJtlD7uxpJC1eBUfbrlcO7RrUKeTeefoG0%3D\"}]}",
        "reporting-endpoints": "heroku-nel=https://nel.heroku.com/reports?ts=1706167498&sid=c4c9725f-1ab0-44d8-820f-430df2718e11&s=OTZf6wqjMxJtlD7uxpJC1eBUfbrlcO7RrUKeTeefoG0%3D",
        "nel": "{\"report_to\":\"heroku-nel\",\"max_age\":3600,\"success_fraction\":0.005,\"failure_fraction\":0.05,\"response_headers\":[\"Via\"]}",
        "x-powered-by": "Express",
        "access-control-allow-origin": "*",
        "etag": "W/\"50-XmcMaub9BFf/y9879X3p35X0L4c\"",
        "via": "1.1 vegur",
        "cf-cache-status": "DYNAMIC",
        "vary": "Accept-Encoding",
        "server": "cloudflare",
        "cf-ray": "84aec7909fed601c-SIN"
      },
      "statusCode": 200
    },
    {
      "requestBody": "",
      "requestHeaders": {
        "host": "reqres.in",
        "connection": "keep-alive",
        "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"91\", \"Chromium\";v=\"91\"",
        "sec-ch-ua-mobile": "?1",
        "user-agent": "Mozilla/5.0 (Linux; Android 12; sdk_gphone64_arm64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36",
        "content-type": "application/json",
        "accept": "*/*",
        "origin": "https://reqres.in",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "referer": "https://reqres.in/",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9",
        "cookie": "_gid=GA1.2.1828776619.1706164095; __stripe_mid=3d0fd295-9d68-4d75-bdb2-55b809fb49ed8dba35; __stripe_sid=466b9d3a-2d7b-4f48-9c66-ca859c8d342f06a86f; _gat=1; _gat_gtag_UA_174008107_1=1; _ga_CESXN06JTW=GS1.1.1706164096.1.1.1706166680.0.0.0; _ga=GA1.1.546181777.1706164095; _ga_WSM10MMEKC=GS1.2.1706164097.1.1.1706166681.0.0.0"
      },
      "url": "https://reqres.in/api/users/2",
      "method": "DELETE",
      "responseBody": "",
      "responseHeaders": {
        "http/1.1 204 no content": "HTTP/1.1 204 No Content",
        "date": "Thu, 25 Jan 2024 07:24:59 GMT",
        "content-length": "0",
        "connection": "close",
        "report-to": "{\"group\":\"heroku-nel\",\"max_age\":3600,\"endpoints\":[{\"url\":\"https://nel.heroku.com/reports?ts=1706167499&sid=c4c9725f-1ab0-44d8-820f-430df2718e11&s=GzTutDCgQC4QQ%2BomNat%2BqJScD%2BtwfgViqmG7fz6%2F9yk%3D\"}]}",
        "reporting-endpoints": "heroku-nel=https://nel.heroku.com/reports?ts=1706167499&sid=c4c9725f-1ab0-44d8-820f-430df2718e11&s=GzTutDCgQC4QQ%2BomNat%2BqJScD%2BtwfgViqmG7fz6%2F9yk%3D",
        "nel": "{\"report_to\":\"heroku-nel\",\"max_age\":3600,\"success_fraction\":0.005,\"failure_fraction\":0.05,\"response_headers\":[\"Via\"]}",
        "x-powered-by": "Express",
        "access-control-allow-origin": "*",
        "etag": "W/\"2-vyGp6PvFo4RvsFtPoIWeCReyIC8\"",
        "via": "1.1 vegur",
        "cf-cache-status": "DYNAMIC",
        "server": "cloudflare",
        "cf-ray": "84aec7977f6c9f77-SIN"
      },
      "statusCode": 204
    }
]
```

