
const axiosInstance = axios.create({
    withCredentials: true
});

const signUpHandler = () => {
    const userName = document.getElementById('rUserName').value;
    const email = document.getElementById('rEmail').value;
    const password = document.getElementById('rPassword').value;
    const confirmPassword = document.getElementById('rcPassword').value;

    if (password != confirmPassword) {
        alert("Passwords do not match, Try Again");
        return;
    }
    const body = {
        userName: userName,
        email: email,
        password: password
    }
    axiosInstance.post("http://localhost:3000/api/register", body)
        .then((response) => {
            alert("Registered Successfully");
        })
        .catch((error) => {
            if (error.response && error.response.status === 409) {
                alert("Email already in use, Try Login");
            } else {
                console.log("Error:", error);
            }
        })
}

const signInHandler = () => {
    const email = document.getElementById('Email').value;
    const password = document.getElementById('Password').value;

    const body = {
        email: email,
        password: password
    }
    axiosInstance.post("http://localhost:3000/api/login", body)
        .then((response) => {
            if (response.status == 200) {
                window.location.href = "http://localhost:3000/menu"
                sessionStorage.setItem('uid', response.data.userCredential.user.uid);
            }
        })
        .catch((error) => {
            if (error.response && error.response.status === 401) {
                alert("Invalid Credentials, Try Again");
            } else {
                console.log("Error:", error);
            }
        })
}

const signOutHandler = () => {
    axiosInstance.post("http://localhost:3000/api/logout")
        .then((response) => {
            console.log(response);
            window.location.href("/");
        })
        .catch((error) => {
            if (error.response && error.response.status === 401) {
                alert("Invalid Credentials, Try Again");
            } else {
                console.log("Error:", error);
            }
        })
}

document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const loginLink = document.getElementById("login-link");
    const signupLink = document.querySelector("#signup-link");

    // Function to toggle between login and register forms
    function toggleForms() {
        loginForm.classList.toggle("hidden");
        signupForm.classList.toggle("hidden");
    }

    // Event listener for the "Back to Login" link
    loginLink.addEventListener("click", function (event) {
        event.preventDefault();
        toggleForms();
    })
    // Event listener for the "Register" link
    signupLink.addEventListener("click", function (event) {
        event.preventDefault();
        toggleForms();
    });

    ;
});  