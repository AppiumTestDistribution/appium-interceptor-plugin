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
        url "*reqres.in*",
        headers: {
            "Authorization" : "Bearer bearertoken"
        }
    }
 }]);

  const userListGetMock = await driver.execute("interceptor: addMock", [{
    config: {
        url "**reqres.in/api/users",
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
        url "*reqres.in*",
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

