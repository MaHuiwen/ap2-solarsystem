//
//  initShaders.js
//
function initShaders( gl, vertexShaderSource, fragmentShaderSource )
{
    var vshader = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource( vshader, vertexShaderSource );
    gl.compileShader( vshader );
    if ( !gl.getShaderParameter(vshader, gl.COMPILE_STATUS) ) {
        var info = gl.getShaderInfoLog( vshader );
        alert( 'Failed to compile Vertex Shader:\n' + info );
    }

    var fshader = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource( fshader, fragmentShaderSource );
    gl.compileShader( fshader );
    if ( !gl.getShaderParameter(fshader, gl.COMPILE_STATUS) ) {
        var info = gl.getShaderInfoLog( fshader );
        alert( 'Failed to compile Fragment Shader:\n' + info );
    }

    var program = gl.createProgram();
    gl.attachShader( program, vshader );
    gl.attachShader( program, fshader );
    gl.linkProgram( program );

    if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
        var info = gl.getProgramInfoLog( program );
        alert( 'Failed to link program:\n' + info );
    }
    return program;
}
