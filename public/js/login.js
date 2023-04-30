fetch("/session").then(async (res) => {
  const json = await res.json();
  document.querySelector("#loading-div").style.display = "none";
  if (json.user) {
    //user is logged in
    document.querySelector("#session-div").style.display = "flex";

    const { user } = json;
    document.querySelector("#session-image").src = user.avatar;
    document.querySelector("#session-name").innerHTML = user.username;
    document.querySelector("#session-username").innerHTML = user.username;
  } else {
    // no session means user not logged in
    document.querySelector("#login-div").style.display = "flex";
  }
});
