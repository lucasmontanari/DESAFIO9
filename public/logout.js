function writeDespedida(data){
    document.querySelector('#despedida').innerHTML = `Hasta luego ${data}!`
}

fetch('http://localhost:8080/user')
    .then(response => response.json())
    .then(data => writeDespedida(data));