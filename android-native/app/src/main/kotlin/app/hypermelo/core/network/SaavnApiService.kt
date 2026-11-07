package app.hypermelo.core.network

import retrofit2.http.GET
import retrofit2.http.Query

interface SaavnApiService {
    @GET("api.php?__call=autocomplete.get&_format=json&_marker=0&ctx=android")
    suspend fun autocomplete(
        @Query("query") query: String
    ): String

    @GET("api.php?__call=search.getResults&_format=json&_marker=0&p=1&n=20")
    suspend fun searchSongs(
        @Query("q") query: String
    ): String

    @GET("api.php?__call=song.getDetails&_format=json")
    suspend fun getSongDetails(
        @Query("pids") songId: String
    ): String
}

