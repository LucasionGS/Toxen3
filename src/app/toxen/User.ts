export default class User {
  constructor() { }

  public static getCurrentUser() {
    let userJson = window.localStorage.getItem("user");

    if (userJson) {
      try {
        return User.create(JSON.parse(userJson));
      } catch (error) {
        console.error("Error parsing User");
        console.error(error);
        return null;
      }
    }
    return null;
  }

  public static create(info: IUser) {
    let user = new User();

    user.token = info.token;
  }
  
  token: string;
}

interface IUser {
  token: string;
}