package models.nodes

import models.commons.{NodeInfo, NodeRoles}
import play.api.libs.json._

object Node extends NodeInfo {

  def apply(id: String, currentMaster: Boolean, info: JsValue, stats: JsValue): JsValue = {
    val jvmVersion = (info \ "jvm" \ "version").asOpt[JsString].getOrElse(JsNull)
    val uptimeMillis = (stats \ "jvm" \ "uptime_in_millis").asOpt[Long].getOrElse(0L)
    val loadAverage = (stats \ "os" \ "cpu" \ "load_average" \ "1m").asOpt[Double].getOrElse(
      (stats \ "os" \ "load_average").asOpt[Double].getOrElse(0.0)
    )
    val nodeRoles = NodeRoles(info)

    Json.obj(
      "id" -> JsString(id),
      "current_master" -> JsBoolean(currentMaster),
      "isMaster" -> JsBoolean(currentMaster),
      "isMasterEligible" -> JsBoolean(nodeRoles.master),
      "name" -> (stats \ "name").as[JsValue],
      "host" -> (stats \ "host").asOpt[JsValue],
      "heap" -> heap(stats),
      "disk" -> disk(stats),
      "cpu" -> cpu(stats),
      "uptime" -> JsString(formatUptime(uptimeMillis)),
      "uptimeMillis" -> JsNumber(uptimeMillis),
      "loadAverage" -> JsNumber(loadAverage),
      "jvm" -> jvmVersion,
      "attributes" -> attrs(info),
      "version" -> (info \ "version").as[JsValue]
    ) ++ roles(info)
  }

  private def roles(info: JsValue): JsObject = {
    val roles = NodeRoles(info)
    Json.obj(
      "master" -> JsBoolean(roles.master),
      "coordinating" -> JsBoolean(roles.coordinating),
      "ingest" -> JsBoolean(roles.ingest),
      "data" -> JsBoolean(roles.data)
    )
  }

  private def cpu(stats: JsValue): JsValue = {
    val load = (stats \ "os" \ "cpu" \ "load_average" \ "1m").asOpt[JsValue].getOrElse(// 5.X
      (stats \ "os" \ "load_average").asOpt[JsValue].getOrElse(JsNull) // FIXME: 2.X
    )
    val osCpu = (stats \ "os" \ "cpu" \ "percent").asOpt[JsValue].getOrElse(// 5.X
      (stats \ "os" \ "cpu_percent").asOpt[JsValue].getOrElse(JsNull) // FIXME 2.X
    )
    Json.obj(
      "process" -> (stats \ "process" \ "cpu" \ "percent").as[JsValue],
      "os" -> osCpu,
      "load" -> load
    )
  }

  private def disk(stats: JsValue): JsValue = {
    val total = (stats \ "fs" \ "total" \ "total_in_bytes").asOpt[Long]
    val available = (stats \ "fs" \ "total" \ "available_in_bytes").asOpt[Long]
    (total, available) match {
      case (Some(t), Some(a)) =>
        val percent = Math.round((1 - (a.toFloat / t.toFloat)) * 100)
        Json.obj(
          "total" -> JsNumber(t),
          "available" -> JsNumber(a),
          "percent" -> JsNumber(percent)
        )
      case _ => JsNull
    }
  }

  private def heap(stats: JsValue): JsValue =
    Json.obj(
      "max" -> (stats \ "jvm" \ "mem" \ "heap_max").as[JsValue],
      "used" -> (stats \ "jvm" \ "mem" \ "heap_used").as[JsValue],
      "percent" -> (stats \ "jvm" \ "mem" \ "heap_used_percent").as[JsValue]
    )

  private def formatUptime(uptimeMillis: Long): String = {
    val seconds = uptimeMillis / 1000
    val minutes = seconds / 60
    val hours = minutes / 60
    val days = hours / 24

    if (days > 0) {
      s"${days}d ${hours % 24}h"
    } else if (hours > 0) {
      s"${hours}h ${minutes % 60}m"
    } else if (minutes > 0) {
      s"${minutes}m"
    } else {
      s"${seconds}s"
    }
  }

}
